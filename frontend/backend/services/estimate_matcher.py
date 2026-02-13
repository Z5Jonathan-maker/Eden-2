"""
Estimate Matcher Service
Compares two Xactimate estimates and identifies differences
"""
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict
from services.pdf_parser import EstimateData, LineItem
import logging

logger = logging.getLogger(__name__)


@dataclass
class LineItemMatch:
    """Represents a matched/unmatched line item between two estimates"""
    status: str  # 'matched', 'added', 'removed', 'modified'
    carrier_item: Optional[Dict] = None
    contractor_item: Optional[Dict] = None
    quantity_diff: float = 0.0
    price_diff: float = 0.0
    total_diff: float = 0.0
    match_confidence: float = 0.0
    variance_type: str = ""  # 'scope', 'quantity', 'price', 'missing', 'extra'
    impact: str = "low"  # 'high', 'medium', 'low'
    notes: str = ""
    
    def to_dict(self):
        return asdict(self)


@dataclass 
class CategoryVariance:
    """Category-level variance summary"""
    category: str
    category_name: str
    carrier_total: float
    contractor_total: float
    variance: float
    variance_pct: float
    item_count_diff: int
    
    def to_dict(self):
        return asdict(self)


@dataclass
class ComparisonResult:
    """Complete comparison result between two estimates"""
    carrier_estimate: Dict
    contractor_estimate: Dict
    matched_items: List[LineItemMatch]
    missing_items: List[LineItemMatch]  # In contractor, not in carrier
    extra_items: List[LineItemMatch]  # In carrier, not in contractor
    modified_items: List[LineItemMatch]
    category_variances: List[CategoryVariance]
    total_variance: float
    total_variance_pct: float
    rcv_variance: float
    summary: Dict
    
    def to_dict(self):
        return {
            'carrier_estimate': self.carrier_estimate,
            'contractor_estimate': self.contractor_estimate,
            'matched_items': [m.to_dict() for m in self.matched_items],
            'missing_items': [m.to_dict() for m in self.missing_items],
            'extra_items': [m.to_dict() for m in self.extra_items],
            'modified_items': [m.to_dict() for m in self.modified_items],
            'category_variances': [c.to_dict() for c in self.category_variances],
            'total_variance': self.total_variance,
            'total_variance_pct': self.total_variance_pct,
            'rcv_variance': self.rcv_variance,
            'summary': self.summary
        }


class EstimateMatcher:
    """Compares two Xactimate estimates and identifies variances"""
    
    # Category name mapping
    CATEGORY_NAMES = {
        'ACM': 'Acoustical Ceiling',
        'APL': 'Appliances',
        'AWN': 'Awnings',
        'CAB': 'Cabinetry',
        'CLN': 'Cleaning',
        'CNT': 'Contents',
        'CON': 'Concrete',
        'DEM': 'Demolition',
        'DOR': 'Doors',
        'DRY': 'Drywall',
        'ELE': 'Electrical',
        'EXT': 'Exterior',
        'FEN': 'Fencing',
        'FIN': 'Finish Carpentry',
        'FLR': 'Flooring',
        'FRM': 'Framing',
        'GEN': 'General',
        'GUT': 'Gutters',
        'HVC': 'HVAC',
        'INS': 'Insulation',
        'LND': 'Landscaping',
        'MAS': 'Masonry',
        'MBL': 'Marble/Granite',
        'MIR': 'Mirrors',
        'PAD': 'Padding',
        'PNT': 'Painting',
        'PLB': 'Plumbing',
        'PLS': 'Plaster',
        'RFG': 'Roofing',
        'SID': 'Siding',
        'STU': 'Stucco',
        'TIL': 'Tile',
        'TRE': 'Trees/Shrubs',
        'WIN': 'Windows',
        'WTR': 'Water Extraction',
        'WDP': 'Wood Panel'
    }
    
    def __init__(self):
        self.match_threshold = 0.7  # Minimum similarity for matching
    
    def compare_estimates(
        self, 
        carrier_estimate: EstimateData, 
        contractor_estimate: EstimateData
    ) -> ComparisonResult:
        """Compare two estimates and return detailed variances"""
        
        matched = []
        missing = []
        extra = []
        modified = []
        
        # Track which items have been matched
        carrier_matched = set()
        contractor_matched = set()
        
        # First pass: Find exact and similar matches
        for c_idx, carrier_item in enumerate(carrier_estimate.line_items):
            best_match = None
            best_score = 0.0
            best_idx = -1
            
            for t_idx, contractor_item in enumerate(contractor_estimate.line_items):
                if t_idx in contractor_matched:
                    continue
                
                score = self._calculate_similarity(carrier_item, contractor_item)
                if score > best_score:
                    best_score = score
                    best_match = contractor_item
                    best_idx = t_idx
            
            if best_match and best_score >= self.match_threshold:
                carrier_matched.add(c_idx)
                contractor_matched.add(best_idx)
                
                # Calculate differences
                qty_diff = best_match.quantity - carrier_item.quantity
                price_diff = best_match.unit_price - carrier_item.unit_price
                total_diff = best_match.total - carrier_item.total
                
                match_item = LineItemMatch(
                    status='matched' if total_diff == 0 else 'modified',
                    carrier_item=carrier_item.to_dict(),
                    contractor_item=best_match.to_dict(),
                    quantity_diff=qty_diff,
                    price_diff=price_diff,
                    total_diff=total_diff,
                    match_confidence=best_score,
                    variance_type=self._determine_variance_type(qty_diff, price_diff, total_diff),
                    impact=self._determine_impact(total_diff),
                    notes=self._generate_variance_notes(carrier_item, best_match, qty_diff, price_diff)
                )
                
                if total_diff != 0:
                    modified.append(match_item)
                else:
                    matched.append(match_item)
        
        # Find missing items (in contractor but not carrier)
        for t_idx, contractor_item in enumerate(contractor_estimate.line_items):
            if t_idx not in contractor_matched:
                missing.append(LineItemMatch(
                    status='missing',
                    carrier_item=None,
                    contractor_item=contractor_item.to_dict(),
                    total_diff=contractor_item.total,
                    variance_type='missing',
                    impact=self._determine_impact(contractor_item.total),
                    notes=f"Missing from carrier estimate: {contractor_item.description}"
                ))
        
        # Find extra items (in carrier but not contractor)
        for c_idx, carrier_item in enumerate(carrier_estimate.line_items):
            if c_idx not in carrier_matched:
                extra.append(LineItemMatch(
                    status='extra',
                    carrier_item=carrier_item.to_dict(),
                    contractor_item=None,
                    total_diff=-carrier_item.total,
                    variance_type='extra',
                    impact=self._determine_impact(carrier_item.total),
                    notes=f"Extra item in carrier estimate: {carrier_item.description}"
                ))
        
        # Calculate category variances
        category_variances = self._calculate_category_variances(
            carrier_estimate, contractor_estimate
        )
        
        # Calculate total variance
        carrier_total = carrier_estimate.total_rcv
        contractor_total = contractor_estimate.total_rcv
        total_variance = contractor_total - carrier_total
        total_variance_pct = (total_variance / carrier_total * 100) if carrier_total > 0 else 0
        
        # Build summary
        summary = self._build_summary(
            matched, missing, extra, modified,
            carrier_total, contractor_total, total_variance
        )
        
        return ComparisonResult(
            carrier_estimate=carrier_estimate.to_dict(),
            contractor_estimate=contractor_estimate.to_dict(),
            matched_items=matched,
            missing_items=missing,
            extra_items=extra,
            modified_items=modified,
            category_variances=category_variances,
            total_variance=total_variance,
            total_variance_pct=total_variance_pct,
            rcv_variance=total_variance,
            summary=summary
        )
    
    def _calculate_similarity(self, item1: LineItem, item2: LineItem) -> float:
        """Calculate similarity score between two line items"""
        score = 0.0
        
        # Category match (30%)
        if item1.category == item2.category:
            score += 0.3
        
        # Code match (20%)
        if item1.code and item2.code and item1.code == item2.code:
            score += 0.2
        
        # Description similarity (30%)
        desc_sim = self._text_similarity(item1.description, item2.description)
        score += desc_sim * 0.3
        
        # Unit match (10%)
        if item1.unit == item2.unit:
            score += 0.1
        
        # Room match (10%)
        if item1.room and item2.room:
            if item1.room.lower() == item2.room.lower():
                score += 0.1
            elif any(word in item2.room.lower() for word in item1.room.lower().split()):
                score += 0.05
        
        return score
    
    def _text_similarity(self, text1: str, text2: str) -> float:
        """Calculate text similarity using word overlap"""
        if not text1 or not text2:
            return 0.0
        
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        # Remove common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'with', '-', '&'}
        words1 = words1 - stop_words
        words2 = words2 - stop_words
        
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return intersection / union if union > 0 else 0.0
    
    def _determine_variance_type(self, qty_diff: float, price_diff: float, total_diff: float) -> str:
        """Determine the type of variance"""
        if qty_diff != 0 and price_diff != 0:
            return 'quantity_and_price'
        elif qty_diff != 0:
            return 'quantity'
        elif price_diff != 0:
            return 'price'
        elif total_diff != 0:
            return 'total'
        return 'none'
    
    def _determine_impact(self, amount: float) -> str:
        """Determine impact level based on dollar amount"""
        abs_amount = abs(amount)
        if abs_amount >= 1000:
            return 'high'
        elif abs_amount >= 250:
            return 'medium'
        return 'low'
    
    def _generate_variance_notes(
        self, 
        carrier_item: LineItem, 
        contractor_item: LineItem,
        qty_diff: float,
        price_diff: float
    ) -> str:
        """Generate human-readable notes about the variance"""
        notes = []
        
        if qty_diff != 0:
            direction = "higher" if qty_diff > 0 else "lower"
            notes.append(f"Quantity is {abs(qty_diff):.2f} {carrier_item.unit} {direction}")
        
        if price_diff != 0:
            direction = "higher" if price_diff > 0 else "lower"
            notes.append(f"Unit price is ${abs(price_diff):.2f} {direction}")
        
        return "; ".join(notes) if notes else "Amounts match"
    
    def _calculate_category_variances(
        self,
        carrier_estimate: EstimateData,
        contractor_estimate: EstimateData
    ) -> List[CategoryVariance]:
        """Calculate variance by category"""
        variances = []
        
        # Get all categories
        all_categories = set(carrier_estimate.categories.keys()) | set(contractor_estimate.categories.keys())
        
        for category in sorted(all_categories):
            carrier_total = carrier_estimate.categories.get(category, 0.0)
            contractor_total = contractor_estimate.categories.get(category, 0.0)
            variance = contractor_total - carrier_total
            variance_pct = (variance / carrier_total * 100) if carrier_total > 0 else (100 if contractor_total > 0 else 0)
            
            # Count items in each category
            carrier_count = sum(1 for item in carrier_estimate.line_items if item.category == category)
            contractor_count = sum(1 for item in contractor_estimate.line_items if item.category == category)
            
            variances.append(CategoryVariance(
                category=category,
                category_name=self.CATEGORY_NAMES.get(category, category),
                carrier_total=carrier_total,
                contractor_total=contractor_total,
                variance=variance,
                variance_pct=variance_pct,
                item_count_diff=contractor_count - carrier_count
            ))
        
        # Sort by absolute variance (highest first)
        variances.sort(key=lambda v: abs(v.variance), reverse=True)
        
        return variances
    
    def _build_summary(
        self,
        matched: List[LineItemMatch],
        missing: List[LineItemMatch],
        extra: List[LineItemMatch],
        modified: List[LineItemMatch],
        carrier_total: float,
        contractor_total: float,
        total_variance: float
    ) -> Dict:
        """Build a summary of the comparison"""
        
        missing_total = sum(m.total_diff for m in missing)
        extra_total = sum(abs(m.total_diff) for m in extra)
        modified_total = sum(m.total_diff for m in modified)
        
        high_impact = [m for m in (missing + modified) if m.impact == 'high']
        
        return {
            'total_line_items_compared': len(matched) + len(modified) + len(missing) + len(extra),
            'matched_count': len(matched),
            'missing_count': len(missing),
            'extra_count': len(extra),
            'modified_count': len(modified),
            'carrier_total': carrier_total,
            'contractor_total': contractor_total,
            'total_variance': total_variance,
            'total_variance_pct': (total_variance / carrier_total * 100) if carrier_total > 0 else 0,
            'missing_items_total': missing_total,
            'extra_items_total': extra_total,
            'modified_items_variance': modified_total,
            'high_impact_items': len(high_impact),
            'recommendation': self._generate_recommendation(
                missing_total, extra_total, modified_total, total_variance
            )
        }
    
    def _generate_recommendation(
        self,
        missing_total: float,
        extra_total: float,
        modified_total: float,
        total_variance: float
    ) -> str:
        """Generate a recommendation based on the comparison"""
        if total_variance > 0:
            if missing_total > 0:
                return f"The contractor estimate includes ${missing_total:,.2f} in line items not covered by the carrier. These items should be reviewed for supplemental claim submission."
            return f"The contractor estimate is ${total_variance:,.2f} higher. Review modified items for negotiation opportunities."
        elif total_variance < 0:
            return f"The carrier estimate is ${abs(total_variance):,.2f} higher than the contractor estimate. Review for potential scope items the contractor may have missed."
        return "Estimates are closely aligned. Minor variances may be due to pricing differences."


# Singleton instance
matcher = EstimateMatcher()


def compare_estimates(carrier: EstimateData, contractor: EstimateData) -> ComparisonResult:
    """Convenience function to compare two estimates"""
    return matcher.compare_estimates(carrier, contractor)
