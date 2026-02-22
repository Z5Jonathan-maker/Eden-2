"""
Workbook Engine - Backend routes for companion workbooks
Manages structured interactive workbook content for Care Claims University
"""

from fastapi import APIRouter, HTTPException, Depends
from dependencies import db, get_current_active_user
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/university/workbooks", tags=["workbooks"])


# ========== MODELS ==========

class WorkbookComponent(BaseModel):
    component_type: str  # SectionHeader, SubHeader, BodyBlock, PrincipleCard, etc.
    visual_weight: str = "secondary"  # primary | secondary | accent
    layout_style: str = "full_width"  # full_width | split_panel | card_grid | stacked | diagram_canvas
    interaction_mode: str = "read"  # read | flip | select | branch | evaluate
    content_payload: Dict[str, Any] = {}


class WorkbookCreate(BaseModel):
    title: str
    description: str
    source_book: Optional[str] = None
    category: str = "workbook"
    estimated_time: Optional[str] = None
    components: List[WorkbookComponent] = []
    is_published: bool = False


class WorkbookUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    source_book: Optional[str] = None
    category: Optional[str] = None
    estimated_time: Optional[str] = None
    components: Optional[List[WorkbookComponent]] = None
    is_published: Optional[bool] = None


class Workbook(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    source_book: Optional[str] = None
    category: str = "workbook"
    estimated_time: Optional[str] = None
    components: List[WorkbookComponent] = []
    is_published: bool = False
    created_by: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None


# ========== ROUTES ==========

@router.get("")
async def get_workbooks(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all published workbooks"""
    query = {}
    is_admin = current_user.get("role") in ["admin", "manager"]

    if not is_admin:
        query["is_published"] = True
    if category:
        query["category"] = category

    workbooks = await db.workbooks.find(query, {"_id": 0}).to_list(100)
    return workbooks


@router.get("/{workbook_id}")
async def get_workbook(
    workbook_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a single workbook with all components"""
    workbook = await db.workbooks.find_one({"id": workbook_id}, {"_id": 0})
    if not workbook:
        raise HTTPException(status_code=404, detail="Workbook not found")

    is_admin = current_user.get("role") in ["admin", "manager"]
    if not is_admin and not workbook.get("is_published"):
        raise HTTPException(status_code=403, detail="Access denied")

    return workbook


@router.post("")
async def create_workbook(
    workbook_data: WorkbookCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new workbook (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can create workbooks")

    workbook = Workbook(
        title=workbook_data.title,
        description=workbook_data.description,
        source_book=workbook_data.source_book,
        category=workbook_data.category,
        estimated_time=workbook_data.estimated_time,
        components=workbook_data.components,
        is_published=workbook_data.is_published,
        created_by=current_user.get("email", "unknown")
    )

    workbook_dict = workbook.model_dump()
    workbook_dict["created_at"] = datetime.now(timezone.utc).isoformat()

    await db.workbooks.insert_one(workbook_dict)
    logger.info(f"Workbook created: {workbook.title} by {current_user.get('email')}")

    return {"id": workbook.id, "message": "Workbook created successfully"}


@router.put("/{workbook_id}")
async def update_workbook(
    workbook_id: str,
    workbook_data: WorkbookUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a workbook (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can edit workbooks")

    existing = await db.workbooks.find_one({"id": workbook_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Workbook not found")

    update_data = {k: v for k, v in workbook_data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")

    await db.workbooks.update_one({"id": workbook_id}, {"$set": update_data})
    return {"message": "Workbook updated successfully"}


@router.delete("/{workbook_id}")
async def delete_workbook(
    workbook_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a workbook (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete workbooks")

    result = await db.workbooks.delete_one({"id": workbook_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workbook not found")

    return {"message": "Workbook deleted successfully"}


@router.put("/{workbook_id}/publish")
async def toggle_publish(
    workbook_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Toggle workbook publish status"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can publish workbooks")

    workbook = await db.workbooks.find_one({"id": workbook_id})
    if not workbook:
        raise HTTPException(status_code=404, detail="Workbook not found")

    new_status = not workbook.get("is_published", False)
    await db.workbooks.update_one(
        {"id": workbook_id},
        {"$set": {"is_published": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"is_published": new_status, "message": f"Workbook {'published' if new_status else 'unpublished'}"}


# ========== SEED DATA ==========

EXTREME_OWNERSHIP_WORKBOOK_ID = "extreme-ownership-care-claims-v1"


async def seed_workbooks():
    """Seed the Extreme Ownership companion workbook (idempotent upsert)."""
    print("[seed_workbooks] Starting workbook seed...")

    workbook = {
        "id": EXTREME_OWNERSHIP_WORKBOOK_ID,
        "title": "Extreme Ownership — Care Claims Field Application",
        "description": "A hands-on companion workbook applying Jocko Willink's Extreme Ownership principles to public adjusting. Built for Care Claims adjusters who lead from the front.",
        "source_book": "Extreme Ownership by Jocko Willink & Leif Babin",
        "category": "leadership",
        "estimated_time": "90 min",
        "is_published": True,
        "created_by": "system",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "components": [
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Extreme Ownership: The Leader Is Always Responsible",
                    "subtitle": "There are no bad teams, only bad leaders. Every outcome — good or bad — starts with you.",
                    "section_number": 1
                }
            },
            {
                "component_type": "BodyBlock",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "text": "Extreme Ownership is the foundational principle: the leader is responsible for everything in their world. No excuses. No blaming subordinates, peers, equipment, or circumstances. When a claim is underpaid, when a homeowner churns, when a deadline is missed — the leader looks in the mirror first.",
                    "emphasis": "At Care Claims, this means every adjuster owns their file from first knock to final settlement. The carrier didn't lowball you — your documentation wasn't strong enough. The homeowner didn't ghost you — your communication cadence failed. Own it. Fix it. Win.",
                    "label": "Core Doctrine"
                }
            },
            {
                "component_type": "PrincipleCard",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "principle_number": 1,
                    "name": "Extreme Ownership",
                    "distilled_meaning": "The leader is responsible for everything in their world. No one else to blame.",
                    "care_claims_context": "When a claim is underpaid, when documentation is weak, when a homeowner is unhappy — you own it. Not the carrier. Not the homeowner. Not your team. You.",
                    "ownership_shift": {
                        "before": "The carrier lowballed us. Their adjuster didn't even look at the interior damage.",
                        "after": "I failed to document the interior damage thoroughly enough to make it undeniable. I need to re-inspect, add moisture readings, and resubmit with a stronger narrative."
                    }
                }
            },
            {
                "component_type": "FlashcardSet",
                "visual_weight": "secondary",
                "layout_style": "card_grid",
                "interaction_mode": "flip",
                "content_payload": {
                    "title": "Ownership vs. Excuse — Flip to Reveal",
                    "cards": [
                        {
                            "front": "The homeowner won't return my calls.",
                            "back": "I haven't given the homeowner a compelling reason to call me back. My last message was vague. I need to send a specific update with a clear next step and a deadline.",
                            "card_type": "ownership_shift"
                        },
                        {
                            "front": "The carrier is dragging their feet on this supplement.",
                            "back": "I submitted the supplement without a follow-up cadence. I need to set calendar reminders for 48-hour check-ins and document every delay for potential bad faith leverage.",
                            "card_type": "ownership_shift"
                        },
                        {
                            "front": "My territory has been picked over — there's nothing left to knock.",
                            "back": "I haven't expanded my storm data research or identified secondary damage zones. I need to pull NOAA reports for adjacent dates and cross-reference with older roof permit data.",
                            "card_type": "ownership_shift"
                        },
                        {
                            "front": "The new guy on my team keeps making mistakes on his paperwork.",
                            "back": "I haven't trained him properly or reviewed his work before submission. His mistakes are my mistakes until he's proven capable. I need to implement a review checkpoint.",
                            "card_type": "ownership_shift"
                        }
                    ]
                }
            },
            {
                "component_type": "Divider",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {}
            },
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Cover and Move: No One Fights Alone",
                    "subtitle": "Teams win when every member supports the mission. Silos lose claims.",
                    "section_number": 2
                }
            },
            {
                "component_type": "PrincipleCard",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "principle_number": 2,
                    "name": "Cover and Move",
                    "distilled_meaning": "Teamwork. Every individual and team must work together to accomplish the mission.",
                    "care_claims_context": "Door knockers feed adjusters. Adjusters feed the negotiation pipeline. The office supports the field. When one link breaks, the whole chain fails. Your job is not just your file — it's the mission.",
                    "ownership_shift": {
                        "before": "That's not my department. I knock doors, I don't handle supplements.",
                        "after": "The supplement is stuck because the field notes I submitted were incomplete. Let me coordinate with the supplements team to fill the gaps from my inspection photos."
                    }
                }
            },
            {
                "component_type": "ScenarioDrill",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "select",
                "content_payload": {
                    "scenario": "You're a door knocker who just signed a homeowner. Your adjuster teammate is overwhelmed with 15 open inspections. The homeowner asks when the inspection will happen. What do you do?",
                    "decision_point": "How do you apply Cover and Move?",
                    "options": [
                        {"label": "Tell the homeowner your adjuster will call them within a week.", "is_correct": false, "explanation": "This is passing the problem. The homeowner will feel abandoned and may cancel."},
                        {"label": "Offer to do the initial photo documentation yourself and brief the adjuster with a complete package.", "is_correct": true, "explanation": "Cover and Move. You're supporting your teammate by reducing their workload and keeping the homeowner engaged. The mission moves forward."},
                        {"label": "Escalate to your manager and ask them to reassign the file.", "is_correct": false, "explanation": "This might be necessary eventually, but the first move is to support your teammate directly. Leadership means acting before escalating."},
                        {"label": "Tell the homeowner you'll find them a different adjuster.", "is_correct": false, "explanation": "This undermines your teammate and creates confusion. Cover and Move means supporting the team, not replacing them."}
                    ]
                }
            },
            {
                "component_type": "Divider",
                "visual_weight": "secondary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {}
            },
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Keep It Simple: Complexity Kills Claims",
                    "subtitle": "If your homeowner doesn't understand the plan, you don't have a plan.",
                    "section_number": 3
                }
            },
            {
                "component_type": "PrincipleCard",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "principle_number": 3,
                    "name": "Keep It Simple",
                    "distilled_meaning": "Simplify the plan so everyone understands it. Complexity leads to confusion and failure.",
                    "care_claims_context": "Your homeowner should be able to explain what's happening with their claim in two sentences. Your documentation should tell a clear story. Your door pitch should land in 15 seconds.",
                    "ownership_shift": {
                        "before": "The homeowner keeps calling because they don't understand what's going on with their claim.",
                        "after": "I haven't simplified my communication. I need a 3-sentence status update template: what's done, what's next, and when they'll hear from me."
                    }
                }
            },
            {
                "component_type": "InteractiveCoach",
                "visual_weight": "secondary",
                "layout_style": "stacked",
                "interaction_mode": "select",
                "content_payload": {
                    "prompt": "A homeowner asks: 'What's the difference between ACV and RCV?' Which response keeps it simple?",
                    "options": [
                        {"label": "ACV is actual cash value accounting for depreciation, while RCV is replacement cost value representing the full cost before depreciation is applied under the dwelling coverage section of your HO-3 policy.", "is_recommended": false, "feedback": "Too much jargon. The homeowner is now more confused than before they asked."},
                        {"label": "The first check covers part of the repair cost minus the age of your roof. Once repairs are done, insurance sends a second check for the rest. We manage both for you.", "is_recommended": true, "feedback": "Keep It Simple. Plain language, clear sequence, and it tells them what to expect. This is how you build trust."},
                        {"label": "Don't worry about it — we handle all of that for you.", "is_recommended": false, "feedback": "Dismissive. The homeowner asked a question because they want to understand. Educate them simply, don't wave them off."}
                    ]
                }
            },
            {
                "component_type": "Divider",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {}
            },
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Prioritize and Execute",
                    "subtitle": "When overwhelmed, step back. Identify the highest-priority problem. Attack it. Move to the next.",
                    "section_number": 4
                }
            },
            {
                "component_type": "PrincipleCard",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "principle_number": 4,
                    "name": "Prioritize and Execute",
                    "distilled_meaning": "When multiple problems hit, don't try to solve them all at once. Prioritize and attack the most critical one first.",
                    "care_claims_context": "Storm season hits. You have 20 open claims, 5 new inspections, and 3 supplement deadlines. Panic helps no one. Rank by deadline and dollar impact. Attack sequentially.",
                    "ownership_shift": {
                        "before": "I'm drowning. Everything is urgent. I can't keep up.",
                        "after": "I'm going to rank my tasks: supplement deadlines first (time-bound, highest recovery), then inspections (revenue pipeline), then follow-ups. One at a time."
                    }
                }
            },
            {
                "component_type": "FlowDiagram",
                "visual_weight": "primary",
                "layout_style": "diagram_canvas",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Prioritize and Execute — Decision Flow",
                    "description": "When overwhelmed, follow this sequence",
                    "flow_type": "linear_flow",
                    "nodes": [
                        {"id": "start", "label": "Multiple Problems Hit", "type": "start"},
                        {"id": "step1", "label": "STOP. Step back. Breathe.", "type": "decision"},
                        {"id": "step2", "label": "List all problems on paper", "type": "correct"},
                        {"id": "step3", "label": "Rank by: deadline + dollar impact", "type": "correct"},
                        {"id": "step4", "label": "Attack #1 with full focus", "type": "correct"},
                        {"id": "step5", "label": "Complete or delegate #1", "type": "decision"},
                        {"id": "step6", "label": "Move to #2. Repeat.", "type": "outcome"}
                    ]
                }
            },
            {
                "component_type": "Divider",
                "visual_weight": "secondary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {}
            },
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Decentralized Command",
                    "subtitle": "Leaders at every level must make decisions. Waiting for permission loses claims.",
                    "section_number": 5
                }
            },
            {
                "component_type": "PrincipleCard",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "principle_number": 5,
                    "name": "Decentralized Command",
                    "distilled_meaning": "Every leader must understand the mission and make decisions at their level without waiting for orders.",
                    "care_claims_context": "In the field, you ARE the decision-maker. A carrier adjuster misidentifies damage during a joint inspection — you correct it on-site, respectfully and with evidence. You don't wait for your manager to send a letter next week.",
                    "ownership_shift": {
                        "before": "I need to check with my manager before I can respond to this carrier objection.",
                        "after": "I understand our standards and our position. I'll address the carrier's objection directly with the documented evidence, then brief my manager on what I decided and why."
                    }
                }
            },
            {
                "component_type": "ScenarioDrill",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "select",
                "content_payload": {
                    "scenario": "During a carrier inspection, the insurance adjuster calls obvious wind damage 'wear and tear.' Your manager is not present. What do you do?",
                    "decision_point": "Decentralized Command — act or wait?",
                    "options": [
                        {"label": "Politely note the disagreement and let your manager handle it in the written response.", "is_correct": false, "explanation": "Waiting allows an incorrect characterization to be documented. By then, the carrier has set the narrative."},
                        {"label": "Respectfully correct the misidentification on-site, point to specific damage indicators, and note the disagreement in your field report.", "is_correct": true, "explanation": "Decentralized Command. You have the knowledge and authority to act at the point of contact. Correct it now, document it, brief your manager after."},
                        {"label": "Agree with the carrier to maintain the relationship and fight it on paper later.", "is_correct": false, "explanation": "Never agree with an inaccurate assessment. Agreeing weakens your position and signals acceptance."},
                        {"label": "Take additional photos and submit a separate report without addressing the carrier's assessment.", "is_correct": false, "explanation": "Photos help, but failing to challenge the on-site assessment in real-time lets the carrier's version become the default record."}
                    ]
                }
            },
            {
                "component_type": "Divider",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {}
            },
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Self-Assessment: Where Do You Stand?",
                    "subtitle": "Rate yourself honestly on each principle. No one sees this but you.",
                    "section_number": 6
                }
            },
            {
                "component_type": "SelfAssessmentScale",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "select",
                "content_payload": {
                    "title": "Extreme Ownership Self-Assessment",
                    "scale_labels": ["Never", "Rarely", "Sometimes", "Usually", "Always"],
                    "statements": [
                        "When a claim outcome is poor, my first instinct is to examine what I could have done differently.",
                        "I proactively support teammates even when their work isn't directly my responsibility.",
                        "I can explain any claim status to a homeowner in two sentences or fewer.",
                        "When overwhelmed, I stop, prioritize by impact, and attack one problem at a time.",
                        "I make field decisions confidently without waiting for manager approval on routine matters.",
                        "I document every interaction and inspection thoroughly enough that anyone could pick up my file.",
                        "I follow up with homeowners on a consistent cadence regardless of how busy I am.",
                        "When I see a teammate struggling, I offer specific help rather than waiting to be asked."
                    ]
                }
            },
            {
                "component_type": "ReflectionBlock",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "evaluate",
                "content_payload": {
                    "prompt": "Think about your most recent claim that didn't go as planned. Write your Extreme Ownership statement — what could YOU have done differently? No external factors. No blaming the carrier, the homeowner, or your team. Just you.",
                    "placeholder": "The claim on [address] resulted in [outcome]. Looking back, I could have...",
                    "honesty_check": "If your answer mentions the carrier, the homeowner, the weather, or anyone other than yourself — rewrite it. Extreme Ownership means the mirror is the only place you look."
                }
            },
            {
                "component_type": "Divider",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {}
            },
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Knowledge Check",
                    "subtitle": "12 scenario-based questions. Passing score: 80%. No guessing.",
                    "section_number": 7
                }
            },
            {
                "component_type": "QuizBlock",
                "visual_weight": "primary",
                "layout_style": "stacked",
                "interaction_mode": "select",
                "content_payload": {
                    "title": "Extreme Ownership at Care Claims — Final Knowledge Check",
                    "passing_score": 80,
                    "questions": [
                        {
                            "question": "A homeowner's supplement is denied for 'lack of supporting documentation.' What is the Extreme Ownership response?",
                            "options": [
                                "Request a supervisor review at the carrier.",
                                "Review your own submission line by line, identify gaps, and resubmit with strengthened evidence.",
                                "Ask your manager to take over the negotiation.",
                                "Tell the homeowner the carrier is being difficult."
                            ],
                            "correct_answer": "Review your own submission line by line, identify gaps, and resubmit with strengthened evidence.",
                            "coaching_feedback": "Extreme Ownership: examine your own work first. A stronger file gives you leverage. Blaming the carrier changes nothing."
                        },
                        {
                            "question": "Your door-knocking team has been underperforming for two weeks. As team lead, what principle applies?",
                            "options": [
                                "Prioritize and Execute — rank problems and address them one at a time.",
                                "Extreme Ownership — the team's underperformance is a reflection of your leadership.",
                                "Decentralized Command — let each member figure out their own motivation.",
                                "Keep It Simple — simplify the script and reduce territory."
                            ],
                            "correct_answer": "Extreme Ownership — the team's underperformance is a reflection of your leadership.",
                            "coaching_feedback": "There are no bad teams, only bad leaders. Before critiquing the team, evaluate your own planning, training, and motivation."
                        },
                        {
                            "question": "During a carrier inspection, the adjuster misidentifies wind damage as 'wear and tear.' Your manager is not present. What do you do?",
                            "options": [
                                "Note the disagreement and let your manager handle it later.",
                                "Agree to maintain the relationship and fight on paper.",
                                "Respectfully correct the misidentification on-site with evidence and note it in your field report.",
                                "Take photos and submit a separate report without addressing their assessment."
                            ],
                            "correct_answer": "Respectfully correct the misidentification on-site with evidence and note it in your field report.",
                            "coaching_feedback": "Decentralized Command — lead at the point of contact. Waiting for your manager lets an incorrect characterization become the record."
                        },
                        {
                            "question": "A homeowner asks about ACV vs RCV. What is the Keep It Simple approach?",
                            "options": [
                                "Use proper insurance terminology to sound professional.",
                                "Tell them not to worry about it.",
                                "Explain: first check covers part minus roof age, second check comes after repairs are done. You manage both.",
                                "Send them an article explaining the difference."
                            ],
                            "correct_answer": "Explain: first check covers part minus roof age, second check comes after repairs are done. You manage both.",
                            "coaching_feedback": "Keep It Simple means translating complex concepts into language the homeowner immediately understands. No jargon. No deflection."
                        },
                        {
                            "question": "You have 22 open claims, 5 new inspections, and 3 supplement deadlines in 48 hours. What do you do?",
                            "options": [
                                "Work late every night until caught up.",
                                "Ask your manager to reassign claims.",
                                "Rank by deadline urgency and financial impact. Supplements first, then inspections, then follow-ups.",
                                "Focus on new inspections to prevent homeowners from waiting."
                            ],
                            "correct_answer": "Rank by deadline urgency and financial impact. Supplements first, then inspections, then follow-ups.",
                            "coaching_feedback": "Prioritize and Execute: supplements are time-bound and high-value. Working late is not a strategy. Ranking by impact is."
                        },
                        {
                            "question": "A fellow adjuster's homeowner calls you upset — no communication in 18 days. What do you do?",
                            "options": [
                                "Redirect them to their assigned adjuster.",
                                "Apologize on behalf of Care Claims, assure 24-hour contact, alert the adjuster and their lead, offer to assist.",
                                "Take over the claim yourself.",
                                "Report the adjuster to management."
                            ],
                            "correct_answer": "Apologize on behalf of Care Claims, assure 24-hour contact, alert the adjuster and their lead, offer to assist.",
                            "coaching_feedback": "Cover and Move. You represent Care Claims to the homeowner. Address the concern, alert the team, offer support. Don't throw your colleague under the bus."
                        },
                        {
                            "question": "You discover a teammate skipping moisture readings to save time. Their supplements are getting denied. What do you do?",
                            "options": [
                                "Mind your own business.",
                                "Report them to management.",
                                "Pull them aside privately, share your own experience, and offer to show them your workflow.",
                                "Mention it casually at the next team meeting."
                            ],
                            "correct_answer": "Pull them aside privately, share your own experience, and offer to show them your workflow.",
                            "coaching_feedback": "Cover and Move + Extreme Ownership. Direct, empathetic, peer-to-peer accountability. You didn't ignore it, didn't throw them under the bus, and offered practical help."
                        },
                        {
                            "question": "A carrier approves your estimate at 60% of what you submitted. Next move?",
                            "options": [
                                "Accept 60% and move on.",
                                "Tell the homeowner to hire an attorney.",
                                "Review line by line, build a detailed supplement with evidence for each disputed item.",
                                "Call the carrier's adjuster and argue."
                            ],
                            "correct_answer": "Review line by line, build a detailed supplement with evidence for each disputed item.",
                            "coaching_feedback": "Extreme Ownership: don't accept unfavorable outcomes without exhausting your options. Fight with evidence, not emotion."
                        }
                    ]
                }
            },
            {
                "component_type": "Divider",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {}
            },
            {
                "component_type": "SectionHeader",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "read",
                "content_payload": {
                    "title": "Field Challenge: Prove It in the Real World",
                    "subtitle": "Knowledge without application is entertainment. This is where you show what you internalized.",
                    "section_number": 8
                }
            },
            {
                "component_type": "FieldChallenge",
                "visual_weight": "primary",
                "layout_style": "full_width",
                "interaction_mode": "evaluate",
                "content_payload": {
                    "title": "The Extreme Ownership Field Sprint",
                    "description": "Over the next 5 business days, apply every principle from this workbook in your actual Care Claims operations. Each day focuses on one principle. By day 5, all five should be running simultaneously.",
                    "success_criteria": [
                        "Day 1 (Extreme Ownership): Identify one open claim with a suboptimal outcome. Write an ownership statement with zero mention of external factors. Take one corrective action today.",
                        "Day 2 (Cover and Move): Reach out to someone on a different team and complete one action that makes their job easier.",
                        "Day 3 (Keep It Simple): Rewrite one homeowner communication to eliminate jargon and reduce length by 50%. Use it in an actual interaction.",
                        "Day 4 (Prioritize and Execute): Start with a written priority ranking. Execute top 3 before responding to non-urgent messages.",
                        "Day 5 (Decentralized Command): Make one field decision you would normally escalate. Brief your manager afterward with what you decided and why."
                    ],
                    "proof_requirements": [
                        "A daily field journal entry (minimum 5 sentences) for each of the 5 days.",
                        "At least one screenshot or photo showing a tangible result.",
                        "A final reflection entry (minimum 10 sentences) on Day 5.",
                        "Confirmation from a teammate or team lead of observed positive change."
                    ],
                    "time_limit": "5 business days"
                }
            }
        ]
    }

    result = await db.workbooks.update_one(
        {"id": EXTREME_OWNERSHIP_WORKBOOK_ID},
        {"$set": workbook},
        upsert=True,
    )
    action = "inserted" if result.upserted_id else "updated"
    print(f"[seed_workbooks] Extreme Ownership workbook {action} successfully")
    logger.info(f"Extreme Ownership workbook seeded ({action})")
