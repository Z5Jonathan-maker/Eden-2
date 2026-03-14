"""
Gamma Helper Functions - Pack claim data into structured content for each audience type
"""

def pack_claim_base(claim: dict) -> str:
    """Base claim info used by all deck types"""
    return f"""
Claim #: {claim.get('claim_number', 'N/A')}
Client: {claim.get('client_name', 'N/A')}
Address: {claim.get('property_address', 'N/A')}
Loss Date: {claim.get('date_of_loss') or claim.get('loss_date', 'N/A')}
Loss Type: {claim.get('claim_type') or claim.get('loss_type', 'Property Damage')}
Status: {claim.get('status', 'Active')}
Carrier: {claim.get('insurance_company', 'N/A')}
Policy #: {claim.get('policy_number', 'N/A')}
"""


def pack_client_update(claim: dict, timeline: list, tasks: list) -> str:
    """Pack data for client status update deck"""
    
    # Build timeline section
    timeline_str = ""
    if timeline:
        timeline_str = "\n".join(f"- {e.get('date', 'N/A')}: {e.get('label', '')}" for e in timeline)
    else:
        timeline_str = "- Claim filed and under review"
    
    # Build completed tasks
    done_tasks = [t for t in tasks if t.get('done')]
    done_str = "\n".join(f"- {t.get('label', '')}" for t in done_tasks) if done_tasks else "- Initial claim review completed"
    
    # Build open items by owner
    carrier_open = [t for t in tasks if not t.get('done') and t.get('owner') == 'carrier']
    carrier_str = "\n".join(f"- {t.get('label', '')}" for t in carrier_open) if carrier_open else "- Awaiting carrier response"
    
    firm_open = [t for t in tasks if not t.get('done') and t.get('owner') == 'firm']
    firm_str = "\n".join(f"- {t.get('label', '')}" for t in firm_open) if firm_open else "- Continuing to advocate for full settlement"
    
    return pack_claim_base(claim) + f"""
Timeline (key events):
{timeline_str}

What we've done so far:
{done_str}

What is still open on carrier side:
{carrier_str}

What is still open on our side:
{firm_str}
"""


def pack_client_approval(claim: dict, estimate: dict, carrier_offer: dict, key_diffs: list) -> str:
    """Pack data for settlement approval review deck"""
    
    our_total = estimate.get('total', 0) if estimate else 0
    carrier_total = carrier_offer.get('total', 0) if carrier_offer else 0
    difference = our_total - carrier_total
    
    # Build key differences
    diffs_str = ""
    if key_diffs:
        diffs_str = "\n".join(
            f"- {d.get('label', 'Item')}: ours=${d.get('ours', 0):,.2f}, carrier=${d.get('carrier', 0):,.2f}" 
            for d in key_diffs
        )
    else:
        diffs_str = "- Detailed comparison pending"
    
    return pack_claim_base(claim) + f"""
Our estimate:
- Total: ${our_total:,.2f}

Carrier offer:
- Total: ${carrier_total:,.2f}

Difference:
- Amount: ${difference:,.2f}
- Percentage: {(difference / our_total * 100) if our_total > 0 else 0:.1f}%

Key differences in scope:
{diffs_str}
"""


def pack_settlement(claim: dict, settlement: dict, timeline: list, before_after_photos: list) -> str:
    """Pack data for final settlement summary deck"""
    
    gross = settlement.get('gross', 0) if settlement else 0
    deductible = settlement.get('deductible', 0) if settlement else 0
    fee = settlement.get('fee', 0) if settlement else 0
    net = settlement.get('net', gross - deductible - fee) if settlement else 0
    
    # Category breakdown
    categories = settlement.get('categories', {}) if settlement else {}
    cat_str = "\n".join(f"- {k}: ${v:,.2f}" for k, v in categories.items()) if categories else "- See detailed breakdown in file"
    
    # Timeline
    timeline_str = "\n".join(f"- {e.get('date', 'N/A')}: {e.get('label', '')}" for e in timeline) if timeline else "- Timeline available in claim file"
    
    # Photos
    photos_str = ""
    if before_after_photos:
        photos_str = "\n".join(f"- {p.get('label', 'Photo')}: before={p.get('before', 'N/A')}, after={p.get('after', 'N/A')}" for p in before_after_photos)
    else:
        photos_str = "- Photos available in inspection records"
    
    return pack_claim_base(claim) + f"""
Financial summary:
- Gross settlement: ${gross:,.2f}
- Deductible: ${deductible:,.2f}
- Our fee: ${fee:,.2f}
- Net to client: ${net:,.2f}

Category breakdown:
{cat_str}

Key timeline:
{timeline_str}

Before/After photos (IDs or captions):
{photos_str}
"""


def pack_rep_performance(rep: dict, stats: dict) -> str:
    """Pack data for rep performance review deck"""
    
    # Strengths
    strengths = stats.get('strengths', [])
    strengths_str = "\n".join(f"- {s}" for s in strengths) if strengths else "- Strong work ethic\n- Good client rapport"
    
    # Growth areas
    growth = stats.get('growth_areas', [])
    growth_str = "\n".join(f"- {g}" for g in growth) if growth else "- Continue developing skills"
    
    return f"""
Rep: {rep.get('name', rep.get('full_name', 'Team Member'))}
Period: {stats.get('period', 'Current Period')}

Activity:
- Doors knocked: {stats.get('doors', 0)}
- Leads created: {stats.get('leads', 0)}
- Appointments set: {stats.get('appointments', 0)}
- Contracts signed: {stats.get('contracts', 0)}

Conversion:
- Lead → appointment: {stats.get('lead_to_appt', 0):.1f}%
- Appointment → signed: {stats.get('appt_to_signed', 0):.1f}%

Revenue:
- Total revenue: ${stats.get('revenue', 0):,.2f}
- Average deal size: ${stats.get('avg_deal', 0):,.2f}

Strengths:
{strengths_str}

Growth areas:
{growth_str}
"""


def pack_pastor_report(firm: dict, impact: dict) -> str:
    """Pack data for ministry/pastor impact report deck"""
    
    # Testimonies
    testimonies = impact.get('testimonies', [])
    test_str = "\n".join(f"- {t}" for t in testimonies) if testimonies else "- Families served with excellence and integrity"
    
    # Team highlights
    highlights = impact.get('team_highlights', [])
    high_str = "\n".join(f"- {h}" for h in highlights) if highlights else "- Team continues to grow in skill and character"
    
    # Community impact
    community = impact.get('community_impact', [])
    comm_str = "\n".join(f"- {c}" for c in community) if community else "- Active in local community outreach"
    
    # Prayer points
    prayers = impact.get('prayer_points', [])
    prayer_str = "\n".join(f"- {p}" for p in prayers) if prayers else "- Continued favor with carriers\n- Protection for team in field"
    
    # Vision
    vision = impact.get('vision', [])
    vision_str = "\n".join(f"- {v}" for v in vision) if vision else "- Expand to serve more families\n- Develop next generation of leaders"
    
    return f"""
Firm: {firm.get('name', 'Eden Claims')}
Period: {impact.get('period', 'Current Period')}

Families helped:
- Count: {impact.get('families_helped', 0)}

Testimonies:
{test_str}

Financial stewardship:
- Total claim value settled: ${impact.get('total_claim_value', 0):,.2f}
- Fees earned: ${impact.get('fees_earned', 0):,.2f}
- Giving / Kingdom initiatives: ${impact.get('giving', 0):,.2f}

Team highlights:
{high_str}

Community impact:
{comm_str}

Current challenges & prayer points:
{prayer_str}

Vision & next steps:
{vision_str}
"""
