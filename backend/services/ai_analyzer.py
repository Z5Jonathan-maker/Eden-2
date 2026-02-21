"""
AI Analyzer Service
Uses LLM to provide intelligent analysis of estimate comparisons
"""
import os
import json
import logging
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class AIAnalyzer:
    """AI-powered analysis of Xactimate estimate comparisons"""

    def __init__(self):
        from services.ollama_config import get_ollama_api_key, get_ollama_model
        self.api_key = get_ollama_api_key() or os.environ.get('EMERGENT_LLM_KEY')
        self.model_provider = "ollama"
        self.model_name = get_ollama_model()
    
    async def analyze_comparison(
        self, 
        comparison_result: Dict,
        analysis_focus: str = "comprehensive"
    ) -> Dict:
        """
        Analyze an estimate comparison using AI
        
        Args:
            comparison_result: The comparison result from EstimateMatcher
            analysis_focus: Type of analysis - 'comprehensive', 'missing_items', 'pricing', 'scope'
        
        Returns:
            AI analysis with insights and recommendations
        """
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"scales-analysis-{comparison_result.get('carrier_estimate', {}).get('claim_number', 'unknown')}",
                system_message=self._get_system_prompt()
            ).with_model(self.model_provider, self.model_name)
            
            # Build the analysis prompt
            prompt = self._build_analysis_prompt(comparison_result, analysis_focus)
            
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            # Parse the AI response
            return self._parse_ai_response(response, comparison_result)
            
        except Exception as e:
            logger.error(f"AI analysis failed: {str(e)}")
            # Return a fallback analysis
            return self._generate_fallback_analysis(comparison_result)
    
    def _get_system_prompt(self) -> str:
        """Get the system prompt for AI analysis"""
        return """You are an expert insurance claims analyst specializing in Xactimate estimates. Your role is to analyze estimate comparisons and provide actionable insights for claim negotiations.

Your expertise includes:
- Understanding Xactimate line item codes and categories
- Recognizing common carrier tactics for underpaying claims
- Identifying legitimate scope differences vs. unfair adjustments
- Florida insurance regulations and claim handling best practices
- Property damage assessment for roofing, water damage, and general construction

When analyzing comparisons, focus on:
1. Material scope differences that impact claim value
2. Missing line items that should be included
3. Quantity or pricing inconsistencies
4. Items commonly underpaid or omitted by carriers
5. Actionable recommendations for claim negotiation

Provide your analysis in a structured format with clear sections for:
- Executive Summary
- Key Findings (prioritized by impact)
- Missing Items Analysis
- Pricing Variance Analysis
- Negotiation Recommendations
- Supporting Arguments for disputed items

Be direct and assertive in your analysis. Advocate for fair claim resolution based on actual scope of work."""
    
    def _build_analysis_prompt(self, comparison_result: Dict, focus: str) -> str:
        """Build the analysis prompt based on comparison data"""
        summary = comparison_result.get('summary', {})
        
        # Build context about the comparison
        context = f"""
## Estimate Comparison Data

**Carrier Estimate Total:** ${summary.get('carrier_total', 0):,.2f}
**Contractor Estimate Total:** ${summary.get('contractor_total', 0):,.2f}
**Total Variance:** ${summary.get('total_variance', 0):,.2f} ({summary.get('total_variance_pct', 0):.1f}%)

**Line Item Summary:**
- Matched Items: {summary.get('matched_count', 0)}
- Modified Items: {summary.get('modified_count', 0)}
- Missing from Carrier: {summary.get('missing_count', 0)}
- Extra in Carrier: {summary.get('extra_count', 0)}
- High Impact Items: {summary.get('high_impact_items', 0)}

**Missing Items Total:** ${summary.get('missing_items_total', 0):,.2f}
**Modified Items Variance:** ${summary.get('modified_items_variance', 0):,.2f}
"""
        
        # Add category variances
        category_variances = comparison_result.get('category_variances', [])
        if category_variances:
            context += "\n## Category Variances (Top 5):\n"
            for cat in category_variances[:5]:
                if cat['variance'] != 0:
                    context += f"- **{cat['category_name']}**: Carrier ${cat['carrier_total']:,.2f} vs Contractor ${cat['contractor_total']:,.2f} (${cat['variance']:+,.2f})\n"
        
        # Add missing items details
        missing_items = comparison_result.get('missing_items', [])
        if missing_items:
            context += "\n## Missing Items (Top 10 by value):\n"
            sorted_missing = sorted(missing_items, key=lambda x: x.get('total_diff', 0), reverse=True)
            for item in sorted_missing[:10]:
                contractor_item = item.get('contractor_item', {})
                context += f"- {contractor_item.get('description', 'Unknown')}: ${item.get('total_diff', 0):,.2f} ({contractor_item.get('quantity', 0)} {contractor_item.get('unit', '')})\n"
        
        # Add modified items details
        modified_items = comparison_result.get('modified_items', [])
        if modified_items:
            context += "\n## Modified Items (Top 10 by variance):\n"
            sorted_modified = sorted(modified_items, key=lambda x: abs(x.get('total_diff', 0)), reverse=True)
            for item in sorted_modified[:10]:
                carrier_item = item.get('carrier_item', {})
                contractor_item = item.get('contractor_item', {})
                context += f"- {carrier_item.get('description', 'Unknown')}: Carrier ${carrier_item.get('total', 0):,.2f} vs Contractor ${contractor_item.get('total', 0):,.2f} (${item.get('total_diff', 0):+,.2f})\n"
                if item.get('notes'):
                    context += f"  Note: {item.get('notes')}\n"
        
        # Build the specific analysis request
        if focus == "missing_items":
            request = "Focus your analysis on the missing items. Explain why each major missing item should be included and provide supporting arguments for claim negotiation."
        elif focus == "pricing":
            request = "Focus your analysis on pricing variances. Identify items where the carrier's pricing appears below market rates and explain the impact."
        elif focus == "scope":
            request = "Focus your analysis on scope differences. Identify areas where the carrier may have inappropriately reduced the scope of work."
        else:
            request = "Provide a comprehensive analysis covering all aspects of this estimate comparison. Prioritize findings by their impact on the claim value and provide actionable recommendations."
        
        return f"{context}\n\n## Analysis Request\n{request}\n\nProvide your analysis in a structured format with clear sections and specific dollar amounts where relevant."
    
    def _parse_ai_response(self, response: str, comparison_result: Dict) -> Dict:
        """Parse and structure the AI response"""
        summary = comparison_result.get('summary', {})
        
        return {
            'analysis_type': 'ai_powered',
            'model_used': f"{self.model_provider}/{self.model_name}",
            'analysis': response,
            'key_metrics': {
                'total_variance': summary.get('total_variance', 0),
                'missing_items_value': summary.get('missing_items_total', 0),
                'high_impact_count': summary.get('high_impact_items', 0)
            },
            'status': 'success'
        }
    
    def _generate_fallback_analysis(self, comparison_result: Dict) -> Dict:
        """Generate a basic analysis if AI fails"""
        summary = comparison_result.get('summary', {})
        
        analysis_text = f"""## Estimate Comparison Analysis

### Executive Summary
The contractor estimate totals ${summary.get('contractor_total', 0):,.2f}, which is ${abs(summary.get('total_variance', 0)):,.2f} {'higher' if summary.get('total_variance', 0) > 0 else 'lower'} than the carrier estimate of ${summary.get('carrier_total', 0):,.2f}.

### Key Findings
- **{summary.get('missing_count', 0)} line items** are present in the contractor estimate but missing from the carrier estimate, totaling ${summary.get('missing_items_total', 0):,.2f}
- **{summary.get('modified_count', 0)} line items** have differences in quantity or pricing
- **{summary.get('high_impact_items', 0)} high-impact items** require immediate attention

### Recommendation
{summary.get('recommendation', 'Review the detailed line item comparison for negotiation opportunities.')}

*Note: This is an automated summary. For detailed AI-powered insights, please ensure the AI service is properly configured.*
"""
        
        return {
            'analysis_type': 'fallback',
            'model_used': 'none',
            'analysis': analysis_text,
            'key_metrics': {
                'total_variance': summary.get('total_variance', 0),
                'missing_items_value': summary.get('missing_items_total', 0),
                'high_impact_count': summary.get('high_impact_items', 0)
            },
            'status': 'fallback'
        }
    
    async def generate_dispute_letter(
        self,
        comparison_result: Dict,
        items_to_dispute: List[Dict],
        claim_details: Dict
    ) -> str:
        """Generate a professional dispute letter for the claim"""
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            
            chat = LlmChat(
                api_key=self.api_key,
                session_id=f"scales-letter-{claim_details.get('claim_number', 'unknown')}",
                system_message="""You are an expert insurance claims writer. Generate professional, assertive dispute letters that clearly articulate the basis for claim supplements. Use formal business language and cite specific line items and dollar amounts."""
            ).with_model(self.model_provider, self.model_name)
            
            # Build letter prompt
            prompt = f"""Generate a professional dispute letter for the following insurance claim:

**Claim Number:** {claim_details.get('claim_number', 'N/A')}
**Insured:** {claim_details.get('insured_name', 'N/A')}
**Date of Loss:** {claim_details.get('date_of_loss', 'N/A')}

**Items to Dispute:**
"""
            for item in items_to_dispute[:10]:  # Limit to 10 items
                contractor_item = item.get('contractor_item', {})
                prompt += f"- {contractor_item.get('description', 'Unknown')}: ${item.get('total_diff', 0):,.2f}\n"
            
            total_disputed = sum(item.get('total_diff', 0) for item in items_to_dispute)
            prompt += f"\n**Total Amount Disputed:** ${total_disputed:,.2f}\n"
            prompt += "\nGenerate a formal dispute letter requesting review and payment of these items."
            
            user_message = UserMessage(text=prompt)
            response = await chat.send_message(user_message)
            
            return response
            
        except Exception as e:
            logger.error(f"Failed to generate dispute letter: {str(e)}")
            return "Error generating dispute letter. Please try again or compose manually."


# Singleton instance
ai_analyzer = AIAnalyzer()


async def analyze_comparison(comparison_result: Dict, focus: str = "comprehensive") -> Dict:
    """Convenience function to analyze a comparison"""
    return await ai_analyzer.analyze_comparison(comparison_result, focus)


async def generate_dispute_letter(
    comparison_result: Dict, 
    items_to_dispute: List[Dict],
    claim_details: Dict
) -> str:
    """Convenience function to generate a dispute letter"""
    return await ai_analyzer.generate_dispute_letter(
        comparison_result, items_to_dispute, claim_details
    )
