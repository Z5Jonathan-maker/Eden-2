"""
Xactimate PDF Parser Service
Extracts line items from Xactimate estimate PDFs
"""
import fitz  # PyMuPDF
import re
import io
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
import logging

logger = logging.getLogger(__name__)


@dataclass
class LineItem:
    """Represents a single line item from an Xactimate estimate"""
    line_number: int
    category: str
    code: str
    description: str
    quantity: float
    unit: str
    unit_price: float
    total: float
    rcv: Optional[float] = None  # Replacement Cost Value
    depreciation: Optional[float] = None
    acv: Optional[float] = None  # Actual Cash Value
    room: Optional[str] = None
    raw_text: Optional[str] = None
    
    def to_dict(self):
        return asdict(self)


@dataclass
class EstimateData:
    """Represents parsed Xactimate estimate data"""
    file_name: str
    estimate_type: str  # 'carrier', 'contractor', 'pa' (public adjuster)
    claim_number: Optional[str] = None
    insured_name: Optional[str] = None
    date_of_loss: Optional[str] = None
    estimate_date: Optional[str] = None
    line_items: List[LineItem] = None
    total_rcv: float = 0.0
    total_depreciation: float = 0.0
    total_acv: float = 0.0
    categories: Dict[str, float] = None
    raw_text: str = ""
    
    def __post_init__(self):
        if self.line_items is None:
            self.line_items = []
        if self.categories is None:
            self.categories = {}
    
    def to_dict(self):
        return {
            'file_name': self.file_name,
            'estimate_type': self.estimate_type,
            'claim_number': self.claim_number,
            'insured_name': self.insured_name,
            'date_of_loss': self.date_of_loss,
            'estimate_date': self.estimate_date,
            'line_items': [item.to_dict() for item in self.line_items],
            'total_rcv': self.total_rcv,
            'total_depreciation': self.total_depreciation,
            'total_acv': self.total_acv,
            'categories': self.categories,
            'line_item_count': len(self.line_items)
        }


class XactimateParser:
    """Parser for Xactimate PDF estimates"""
    
    # Common Xactimate category codes
    CATEGORY_CODES = {
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
    
    # Unit abbreviations
    UNITS = ['SF', 'LF', 'SY', 'EA', 'HR', 'CY', 'SQ', 'GAL', 'TON', 'BF', 'CF', 'PR', 'SET', 'JOB', 'DAY', 'MO', 'WK']
    
    def __init__(self):
        self.current_room = "General"
        self.current_category = "General"
    
    def parse_pdf(self, pdf_bytes: bytes, file_name: str, estimate_type: str = 'carrier') -> EstimateData:
        """Parse a PDF file and extract estimate data"""
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            
            # First pass: identify which pages contain the estimate
            estimate_pages = []
            all_page_texts = []
            
            for page_num, page in enumerate(doc):
                page_text = page.get_text()
                all_page_texts.append(page_text)
                
                # Check if this page looks like an Xactimate estimate page
                if self._is_estimate_page(page_text):
                    estimate_pages.append(page_num)
            
            doc.close()
            
            # If we found estimate-specific pages, use only those
            # Otherwise, fall back to using all pages
            if estimate_pages:
                full_text = "\n".join([all_page_texts[i] for i in estimate_pages])
                logger.info(f"Found estimate content on pages {estimate_pages} of {len(all_page_texts)} total pages")
            else:
                full_text = "\n".join(all_page_texts)
                logger.info(f"No specific estimate pages identified, using all {len(all_page_texts)} pages")
            
            # Parse the extracted text
            estimate = EstimateData(
                file_name=file_name,
                estimate_type=estimate_type,
                raw_text=full_text
            )
            
            # Extract header information (search all pages for header info)
            self._extract_header_info("\n".join(all_page_texts), estimate)
            
            # Extract line items
            estimate.line_items = self._extract_line_items(full_text)
            
            # If no items found with primary method, try alternative parsing methods
            if len(estimate.line_items) == 0:
                logger.info("Primary parsing found no items, trying alternative methods...")
                estimate.line_items = self._extract_line_items_alternative(full_text)
            
            # Calculate totals and categories
            self._calculate_totals(estimate)
            
            return estimate
            
        except Exception as e:
            logger.error(f"Error parsing PDF {file_name}: {str(e)}")
            raise ValueError(f"Failed to parse PDF: {str(e)}")
    
    def _is_estimate_page(self, page_text: str) -> bool:
        """Check if a page contains Xactimate estimate content"""
        text_lower = page_text.lower()
        
        # Xactimate-specific markers that indicate an estimate page
        estimate_markers = [
            # Column headers common in Xactimate
            'qty', 'unit price', 'rcv', 'acv', 'deprec',
            # Section markers
            'roof covering', 'interior', 'exterior', 'general conditions',
            # Unit types (presence of multiple suggests estimate content)
            ' sf ', ' lf ', ' sq ', ' ea ',
            # Xactimate-specific terminology
            'xactimate', 'xact', 'replacement cost', 'actual cash value',
            'line item', 'category total', 'subtotal',
            # Common roofing/construction terms with pricing indicators
            'tear off', 'r&r ', 'remove and replace', 'install', 
            'shingle', 'underlayment', 'flashing', 'drip edge'
        ]
        
        # Count how many markers are present
        marker_count = sum(1 for marker in estimate_markers if marker in text_lower)
        
        # Also look for the numbered line item pattern (e.g., "1. Description")
        numbered_items = len(re.findall(r'^\s*\d+\.\s+[A-Za-z]', page_text, re.MULTILINE))
        
        # Look for unit + price patterns (e.g., "17.92 SQ  87.23")
        unit_price_patterns = len(re.findall(r'\d+(?:\.\d+)?\s+(?:SQ|SF|LF|EA|HR|CY)\s+\d+(?:\.\d+)?', page_text, re.IGNORECASE))
        
        # Page is likely an estimate page if:
        # - Has 3+ estimate markers, OR
        # - Has 2+ numbered items with unit/price patterns
        return marker_count >= 3 or (numbered_items >= 2 and unit_price_patterns >= 1)
    
    def _extract_header_info(self, text: str, estimate: EstimateData):
        """Extract claim header information from the text"""
        lines = text.split('\n')
        
        # Search through more of the document for header info (not just first 50 lines)
        # as claim info might be buried in a package
        for i, line in enumerate(lines[:200]):  # Check first 200 lines
            line_lower = line.lower().strip()
            line_clean = line.strip()
            
            # Skip very short lines
            if len(line_clean) < 3:
                continue
            
            # Claim number patterns - be more aggressive in finding them
            if not estimate.claim_number:
                claim_patterns = [
                    r'claim\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]+[A-Z0-9])',
                    r'claim\s+number\s*:?\s*([A-Z0-9][A-Z0-9\-]+[A-Z0-9])',
                    r'file\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]+[A-Z0-9])',
                    r'policy\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]+[A-Z0-9])',
                    r'reference\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]+[A-Z0-9])',
                    r'estimate\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-]+[A-Z0-9])'
                ]
                for pattern in claim_patterns:
                    match = re.search(pattern, line_clean, re.IGNORECASE)
                    if match:
                        claim_num = match.group(1).strip()
                        # Validate it looks like a claim number (not just a single letter/digit)
                        if len(claim_num) >= 4:
                            estimate.claim_number = claim_num
                            break
            
            # Insured name patterns
            if not estimate.insured_name:
                if 'insured' in line_lower or 'policyholder' in line_lower or 'homeowner' in line_lower:
                    name_match = re.search(r'(?:insured|policyholder|homeowner)\s*:?\s*(.+)', line_clean, re.IGNORECASE)
                    if name_match:
                        name = name_match.group(1).strip()
                        # Clean up the name
                        name = re.sub(r'\s+', ' ', name)  # Normalize whitespace
                        if len(name) >= 3 and len(name) <= 100:
                            estimate.insured_name = name
                
                # Also try to find name on its own line after "Insured:" header
                if i > 0 and 'insured' in lines[i-1].lower() and len(line_clean) > 3 and len(line_clean) < 50:
                    if not any(c.isdigit() for c in line_clean[:10]):  # Names usually don't start with digits
                        estimate.insured_name = line_clean
            
            # Date of loss patterns
            if not estimate.date_of_loss:
                if 'date of loss' in line_lower or 'loss date' in line_lower or 'dol' in line_lower:
                    date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', line_clean)
                    if date_match:
                        estimate.date_of_loss = date_match.group(1).strip()
            
            # Estimate date patterns
            if not estimate.estimate_date:
                if 'estimate date' in line_lower or 'created' in line_lower or 'prepared' in line_lower:
                    date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', line_clean)
                    if date_match:
                        estimate.estimate_date = date_match.group(1).strip()
    
    def _extract_line_items(self, text: str) -> List[LineItem]:
        """Extract line items from the estimate text"""
        line_items = []
        lines = text.split('\n')
        
        # Track current room/area
        current_room = "General"
        item_count = 0
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            if not line:
                i += 1
                continue
            
            # Check for room/area headers (e.g., "Laminated Shingle Roof", "Garage Roof", "Flat Roof")
            if re.match(r'^((?:Laminated\s+)?(?:Shingle\s+)?Roof)$', line, re.IGNORECASE):
                current_room = line
                i += 1
                continue
            if re.match(r'^(Garage\s+Roof|Flat\s+Roof)$', line, re.IGNORECASE):
                current_room = line
                i += 1
                continue
            if re.match(r'^(Roof Covering|Hip/Ridge|Underlayment|Ordinance & Law|Roof Decking|Roof Vents|Flashing|Drip Edge|General|Labor Minimums)$', line, re.IGNORECASE):
                # Section header - keep current room
                i += 1
                continue
            
            # Skip headers and totals
            if any(skip in line.lower() for skip in ['description', 'quantity', 'unit price', 'total:', 'totals:', 'recap', 'summary', 'page:', 'continued', 'coverage', 'care claims', 'public adjusting', 'business address', 'phone:', 'email:', 'website:', 'lorishamblin', '/2025', '/2024']):
                i += 1
                continue
            
            # Look for line items starting with number and period: "1.  Description text"
            line_item_match = re.match(r'^(\d+)\.\s+(.+)$', line)
            if line_item_match:
                line_num = line_item_match.group(1)
                description = line_item_match.group(2).strip()
                
                # Look ahead to collect the numerical values
                # Format: QTY UNIT, PRICE, TAX, RCV, (DEPREC), ACV on subsequent lines
                try:
                    # The values might be on separate lines or combined
                    values_found = False
                    j = i + 1
                    qty = None
                    unit = None
                    price = None
                    tax = None
                    rcv = None
                    deprec = None
                    acv = None
                    
                    # Look at next several lines for numerical data
                    look_ahead = 10
                    collected_values = []
                    
                    while j < len(lines) and j < i + look_ahead:
                        next_line = lines[j].strip()
                        
                        # Stop if we hit another line item or section
                        if re.match(r'^\d+\.\s+', next_line):
                            break
                        if any(skip in next_line.lower() for skip in ['description', 'total:', 'totals:', 'page:', 'care claims']):
                            break
                            
                        # Try to parse quantity + unit (e.g., "17.92 SQ")
                        qty_unit_match = re.match(r'^(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s*$', next_line, re.IGNORECASE)
                        if qty_unit_match and qty is None:
                            qty = float(qty_unit_match.group(1))
                            unit = qty_unit_match.group(2).upper()
                            j += 1
                            continue
                        
                        # Try to parse single number (price, tax, RCV, etc.)
                        number_match = re.match(r'^\(?(\d+(?:,\d{3})*(?:\.\d+)?)\)?\s*$', next_line)
                        if number_match:
                            val = float(number_match.group(1).replace(',', ''))
                            collected_values.append(val)
                            j += 1
                            continue
                        
                        # Continue description if it's text
                        if next_line and not re.match(r'^[\d\(\),\.\s]+$', next_line):
                            # This might be continuation of description (like "shingles" continuation)
                            if len(next_line) < 30 and not any(c.isdigit() for c in next_line):
                                description += " " + next_line
                        
                        j += 1
                    
                    # Assign collected values: [price, tax, rcv, deprec, acv]
                    if len(collected_values) >= 3 and qty is not None:
                        price = collected_values[0] if len(collected_values) > 0 else 0
                        tax = collected_values[1] if len(collected_values) > 1 else 0
                        rcv = collected_values[2] if len(collected_values) > 2 else 0
                        deprec = collected_values[3] if len(collected_values) > 3 else 0
                        acv = collected_values[4] if len(collected_values) > 4 else rcv
                        
                        category = self._infer_category(description)
                        
                        item = LineItem(
                            line_number=item_count,
                            category=category,
                            code="",
                            description=description,
                            quantity=qty,
                            unit=unit,
                            unit_price=price,
                            total=rcv,
                            rcv=rcv,
                            depreciation=deprec,
                            acv=acv,
                            room=current_room,
                            raw_text=f"{line_num}. {description}"
                        )
                        line_items.append(item)
                        item_count += 1
                        values_found = True
                    
                    if values_found:
                        i = j  # Skip past the values we consumed
                        continue
                        
                except Exception:
                    pass
            
            i += 1
        
        return line_items
    
    def _extract_line_items_alternative(self, text: str) -> List[LineItem]:
        """Alternative extraction method for different Xactimate formats and embedded estimates"""
        line_items = []
        lines = text.split('\n')
        item_count = 0
        current_room = "General"
        
        # Method 1: Look for single-line complete items
        # Pattern: Description + qty + unit + price + total on one line
        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue
            
            # Skip obvious non-data lines
            skip_patterns = ['page', 'total:', 'subtotal', 'grand total', 'coverage', 
                           'policy', 'claim number', 'insured', 'adjuster', 'date:',
                           'phone', 'fax', 'email', 'address', 'po box']
            if any(skip in line.lower() for skip in skip_patterns):
                continue
            
            # Try multiple patterns for single-line items
            item = self._try_parse_single_line(line, item_count, current_room)
            if item:
                line_items.append(item)
                item_count += 1
                continue
            
            # Check for room/section headers
            room_match = re.match(r'^([A-Z][A-Za-z\s/]+(?:Roof|Interior|Exterior|Kitchen|Bathroom|Bedroom|Living|Dining|Garage|Basement))$', line)
            if room_match and len(line) < 40:
                current_room = room_match.group(1)
        
        # Method 2: If still no items, try to find table-like structures
        if len(line_items) == 0:
            line_items = self._extract_from_table_format(text)
        
        return line_items
    
    def _try_parse_single_line(self, line: str, line_number: int, room: str) -> Optional[LineItem]:
        """Try various patterns to parse a single line item"""
        
        # Pattern A: Full line with all columns
        # "Description text here   17.92  SQ   87.23   0.00   1,563.16   (0.00)   1,563.16"
        pattern_full = r'^(.+?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?\s+)?(\d+(?:,\d{3})*(?:\.\d+)?)'
        match = re.match(pattern_full, line, re.IGNORECASE)
        if match:
            description = match.group(1).strip()
            # Filter out header rows
            if any(h in description.lower() for h in ['description', 'item', 'qty', 'quantity', 'unit price', 'total']):
                return None
            if len(description) < 5:  # Too short to be valid
                return None
            
            category = self._infer_category(description)
            total = float(match.group(5).replace(',', ''))
            
            return LineItem(
                line_number=line_number,
                category=category,
                code="",
                description=description,
                quantity=float(match.group(2)),
                unit=match.group(3).upper(),
                unit_price=float(match.group(4)),
                total=total,
                rcv=total,
                room=room,
                raw_text=line
            )
        
        # Pattern B: Shorter format - description, qty, unit, total only
        # "Remove roofing shingles   25.00  SQ   1,125.00"
        pattern_short = r'^(.{10,60}?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$'
        match = re.match(pattern_short, line, re.IGNORECASE)
        if match:
            description = match.group(1).strip()
            if any(h in description.lower() for h in ['description', 'item', 'qty', 'quantity']):
                return None
            if len(description) < 5:
                return None
            
            category = self._infer_category(description)
            total = float(match.group(4).replace(',', ''))
            qty = float(match.group(2))
            unit_price = total / qty if qty > 0 else 0
            
            return LineItem(
                line_number=line_number,
                category=category,
                code="",
                description=description,
                quantity=qty,
                unit=match.group(3).upper(),
                unit_price=unit_price,
                total=total,
                rcv=total,
                room=room,
                raw_text=line
            )
        
        # Pattern C: Line number prefix format
        # "1. Remove roofing shingles   25.00 SQ   45.00   1,125.00"
        pattern_numbered = r'^(\d+)[.\)]\s*(.+?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)'
        match = re.match(pattern_numbered, line, re.IGNORECASE)
        if match:
            description = match.group(2).strip()
            if len(description) < 5:
                return None
            
            category = self._infer_category(description)
            total = float(match.group(6).replace(',', ''))
            
            return LineItem(
                line_number=line_number,
                category=category,
                code="",
                description=description,
                quantity=float(match.group(3)),
                unit=match.group(4).upper(),
                unit_price=float(match.group(5)),
                total=total,
                rcv=total,
                room=room,
                raw_text=line
            )
        
        return None
    
    def _extract_from_table_format(self, text: str) -> List[LineItem]:
        """Extract line items from table-formatted estimates"""
        line_items = []
        lines = text.split('\n')
        item_count = 0
        
        # Look for lines that contain both a unit type and dollar amounts
        for line in lines:
            line = line.strip()
            
            # Must have a unit type
            unit_match = re.search(r'\b(SQ|SF|LF|SY|EA|HR|CY|GAL|TON)\b', line, re.IGNORECASE)
            if not unit_match:
                continue
            
            # Must have at least one dollar amount (with or without $ sign)
            money_matches = re.findall(r'\$?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)', line)
            if len(money_matches) < 1:
                continue
            
            # Try to extract quantity (number before unit)
            qty_pattern = r'(\d+(?:\.\d+)?)\s*' + unit_match.group(1)
            qty_match = re.search(qty_pattern, line, re.IGNORECASE)
            if not qty_match:
                continue
            
            # Get the text portion (description) - everything before the numbers
            # Find where the numeric data starts
            numeric_start = re.search(r'\d+(?:\.\d+)?\s*(?:SQ|SF|LF|SY|EA|HR|CY|GAL|TON)', line, re.IGNORECASE)
            if numeric_start:
                description = line[:numeric_start.start()].strip()
                # Clean up the description
                description = re.sub(r'^\d+[.\)]\s*', '', description)  # Remove line numbers
                description = description.strip(' -–:')
                
                if len(description) >= 5 and not any(h in description.lower() for h in ['description', 'qty', 'total', 'item']):
                    qty = float(qty_match.group(1))
                    total = float(money_matches[-1].replace(',', ''))  # Last money value is usually total
                    unit_price = float(money_matches[0].replace(',', '')) if len(money_matches) > 1 else (total / qty if qty > 0 else 0)
                    
                    category = self._infer_category(description)
                    
                    line_items.append(LineItem(
                        line_number=item_count,
                        category=category,
                        code="",
                        description=description,
                        quantity=qty,
                        unit=unit_match.group(1).upper(),
                        unit_price=unit_price,
                        total=total,
                        rcv=total,
                        room="General",
                        raw_text=line
                    ))
                    item_count += 1
        
        return line_items
    
    def _parse_line_item(self, line: str, line_number: int, room: str) -> Optional[LineItem]:
        """Parse a single line item from text"""
        
        # Pattern 1: Real Xactimate format with line number, description, qty, unit, price, tax, RCV, DEPREC, ACV
        # Example: "1 Tear off, haul and dispose of comp. shingles - Laminated 17.92 SQ 87.23 0.00 1,563.16 (0.00) 1,563.16"
        pattern1 = r'^(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s+\(?(\d+(?:\.\d+)?)\)?\s+(\d+(?:,\d{3})*(?:\.\d+)?)'
        
        match = re.match(pattern1, line, re.IGNORECASE)
        if match:
            description = match.group(2).strip()
            category = self._infer_category(description)
            rcv = float(match.group(7).replace(',', ''))
            depreciation = float(match.group(8).replace(',', ''))
            acv = float(match.group(9).replace(',', ''))
            
            return LineItem(
                line_number=line_number,
                category=category,
                code="",
                description=description,
                quantity=float(match.group(3)),
                unit=match.group(4).upper(),
                unit_price=float(match.group(5)),
                total=rcv,
                rcv=rcv,
                depreciation=depreciation,
                acv=acv,
                room=room,
                raw_text=line
            )
        
        # Pattern 2: Xactimate format with description, qty, unit, price, RCV (no tax column)
        # Example: "Tear off, haul and dispose of comp. shingles 17.92 SQ 87.23 1,563.16"
        pattern2 = r'^(.{15,80}?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$'
        
        match = re.match(pattern2, line, re.IGNORECASE)
        if match:
            description = match.group(1).strip()
            # Skip header rows and total rows
            if any(skip in description.lower() for skip in ['description', 'total', 'subtotal', 'recap', 'summary']):
                return None
            category = self._infer_category(description)
            
            return LineItem(
                line_number=line_number,
                category=category,
                code="",
                description=description,
                quantity=float(match.group(2)),
                unit=match.group(3).upper(),
                unit_price=float(match.group(4)),
                total=float(match.group(5).replace(',', '')),
                room=room,
                raw_text=line
            )
        
        # Pattern 3: Standard Xactimate format with code prefix
        # Example: "1. RFG RFTILE - Remove roofing - tile 45.00 SF 2.45 110.25"
        pattern3 = r'^(\d+)\.\s*([A-Z]{2,4})\s+([A-Z0-9]+)\s*[-–]\s*(.+?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)'
        
        match = re.match(pattern3, line, re.IGNORECASE)
        if match:
            return LineItem(
                line_number=line_number,
                category=match.group(2).upper(),
                code=match.group(3).upper(),
                description=match.group(4).strip(),
                quantity=float(match.group(5)),
                unit=match.group(6).upper(),
                unit_price=float(match.group(7)),
                total=float(match.group(8).replace(',', '')),
                room=room,
                raw_text=line
            )
        
        # Pattern 4: Category code at start without line number
        # Example: "RFG Remove roofing shingles 25.00 SQ 45.00 1125.00"
        pattern4 = r'^([A-Z]{2,4})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$'
        
        match = re.match(pattern4, line, re.IGNORECASE)
        if match:
            return LineItem(
                line_number=line_number,
                category=match.group(1).upper(),
                code="",
                description=match.group(2).strip(),
                quantity=float(match.group(3)),
                unit=match.group(4).upper(),
                unit_price=float(match.group(5)),
                total=float(match.group(6).replace(',', '')),
                room=room,
                raw_text=line
            )
        
        # Pattern 5: Line number, category, description, qty, unit, price, total
        # Example: "1 RFG Remove roofing shingles 25.00 SQ 45.00 1125.00"
        pattern5 = r'^(\d+)\s+([A-Z]{2,4})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$'
        
        match = re.match(pattern5, line, re.IGNORECASE)
        if match:
            return LineItem(
                line_number=line_number,
                category=match.group(2).upper(),
                code="",
                description=match.group(3).strip(),
                quantity=float(match.group(4)),
                unit=match.group(5).upper(),
                unit_price=float(match.group(6)),
                total=float(match.group(7).replace(',', '')),
                room=room,
                raw_text=line
            )
        
        # Pattern 6: Simple description + numbers at end (most flexible)
        # Example: "R&R Hip / Ridge cap 85.33 LF 5.82 496.82"
        pattern6 = r'^(.{5,70}?)\s+(\d+(?:\.\d+)?)\s+(SQ|SF|LF|SY|EA|HR|CY|GAL|TON|BF|CF|PR|SET|JOB|DAY|MO|WK)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s*$'
        
        match = re.match(pattern6, line, re.IGNORECASE)
        if match:
            description = match.group(1).strip()
            # Skip non-item rows
            if any(skip in description.lower() for skip in ['description', 'total', 'subtotal', 'recap', 'summary', 'coverage', 'dwelling']):
                return None
            category = self._infer_category(description)
            
            return LineItem(
                line_number=line_number,
                category=category,
                code="",
                description=description,
                quantity=float(match.group(2)),
                unit=match.group(3).upper(),
                unit_price=float(match.group(4)),
                total=float(match.group(5).replace(',', '')),
                room=room,
                raw_text=line
            )
        
        match = re.match(pattern5, line, re.IGNORECASE)
        if match:
            description = match.group(1).strip()
            category = self._infer_category(description)
            
            return LineItem(
                line_number=line_number,
                category=category,
                code="",
                description=description,
                quantity=float(match.group(2)),
                unit=match.group(3).upper(),
                unit_price=float(match.group(4)),
                total=float(match.group(5).replace(',', '')),
                rcv=float(match.group(5).replace(',', '')),
                depreciation=float(match.group(6).replace(',', '')),
                acv=float(match.group(7).replace(',', '')),
                room=room,
                raw_text=line
            )
        
        return None
    
    def _infer_category(self, description: str) -> str:
        """Infer category from line item description"""
        desc_lower = description.lower()
        
        category_keywords = {
            'RFG': ['roof', 'shingle', 'felt', 'drip edge', 'flashing', 'ridge', 'valley'],
            'DRY': ['drywall', 'sheetrock', 'gypsum', 'wallboard'],
            'PNT': ['paint', 'primer', 'stain', 'coating'],
            'FLR': ['floor', 'carpet', 'tile', 'hardwood', 'vinyl', 'laminate'],
            'PLB': ['plumb', 'pipe', 'faucet', 'toilet', 'sink', 'drain'],
            'ELE': ['electric', 'outlet', 'switch', 'wire', 'circuit', 'panel'],
            'WIN': ['window', 'glass', 'pane', 'glazing'],
            'DOR': ['door', 'entry', 'interior door', 'exterior door'],
            'CAB': ['cabinet', 'vanity', 'countertop'],
            'INS': ['insulation', 'batt', 'blown'],
            'SID': ['siding', 'vinyl siding', 'wood siding'],
            'GUT': ['gutter', 'downspout', 'fascia', 'soffit'],
            'FRM': ['framing', 'stud', 'joist', 'rafter', 'beam'],
            'DEM': ['demo', 'remove', 'tear out', 'haul', 'debris'],
            'CLN': ['clean', 'sanitize', 'deodorize'],
            'WTR': ['water', 'dry out', 'dehumidif', 'extract'],
            'HVC': ['hvac', 'furnace', 'ac', 'duct', 'air condition']
        }
        
        for code, keywords in category_keywords.items():
            for keyword in keywords:
                if keyword in desc_lower:
                    return code
        
        return 'GEN'
    
    def _calculate_totals(self, estimate: EstimateData):
        """Calculate totals and category breakdowns"""
        categories = {}
        total_rcv = 0.0
        total_depreciation = 0.0
        total_acv = 0.0
        
        for item in estimate.line_items:
            # Add to category totals
            if item.category not in categories:
                categories[item.category] = 0.0
            categories[item.category] += item.total
            
            # Sum totals
            total_rcv += item.rcv if item.rcv else item.total
            if item.depreciation:
                total_depreciation += item.depreciation
            if item.acv:
                total_acv += item.acv
        
        estimate.categories = categories
        estimate.total_rcv = total_rcv
        estimate.total_depreciation = total_depreciation
        estimate.total_acv = total_acv if total_acv > 0 else total_rcv - total_depreciation


# Singleton instance
parser = XactimateParser()


def parse_xactimate_pdf(pdf_bytes: bytes, file_name: str, estimate_type: str = 'carrier') -> EstimateData:
    """Convenience function to parse a PDF"""
    return parser.parse_pdf(pdf_bytes, file_name, estimate_type)
