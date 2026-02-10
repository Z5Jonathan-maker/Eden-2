"""
Client Education Hub - Client-facing knowledge base
Addresses common concerns, timelines, and standards for clients
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from dependencies import db, get_current_active_user

router = APIRouter(prefix="/api/client-education", tags=["client-education"])


# ============ MODELS ============

class EducationArticle(BaseModel):
    """Client education article"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category: str  # timeline, policy, documents, faq, communication, glossary
    title: str
    content: str
    order: int = 0
    icon: Optional[str] = None
    is_published: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ClientQuestion(BaseModel):
    """Question from client to their adjuster"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    client_name: str
    client_email: str
    claim_id: Optional[str] = None
    question: str
    category: str = "general"
    status: str = "pending"  # pending, answered, closed
    answer: Optional[str] = None
    answered_by: Optional[str] = None
    answered_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class GlossaryTerm(BaseModel):
    """Insurance/claims glossary term"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    term: str
    definition: str
    category: Optional[str] = None  # insurance, claims, construction, legal


# ============ SEED DATA ============

DEFAULT_ARTICLES = [
    # Timeline Category
    {
        "category": "timeline",
        "title": "Your Claims Journey: What to Expect",
        "order": 1,
        "icon": "calendar",
        "content": """## The Claims Process Timeline

Your claim will typically progress through these stages:

### Week 1-2: Initial Assessment
- We review your policy and damage
- Initial inspection scheduled
- Preliminary scope of work created

### Week 2-4: Documentation
- Detailed estimate prepared
- Photos and documentation compiled
- Carrier submission prepared

### Week 4-8: Carrier Review
- Estimate submitted to insurance carrier
- Adjuster review and response
- Negotiations if needed

### Week 8-12: Resolution
- Final settlement agreed
- Repairs can begin
- Supplements filed if additional damage found

**Note:** Every claim is unique. Complex claims may take longer. We'll keep you updated every step of the way."""
    },
    {
        "category": "timeline",
        "title": "Communication Schedule",
        "order": 2,
        "icon": "message-circle",
        "content": """## When to Expect Updates

### Regular Updates
- **Weekly Status Email**: Every Friday you'll receive a summary
- **Milestone Notifications**: Instant alerts when key events happen
- **Carrier Responses**: Within 24 hours of any carrier communication

### Response Times
- **Urgent Questions**: Same business day
- **General Questions**: Within 48 hours
- **Document Requests**: Within 24 hours

### How to Reach Us
- **Portal Messages**: Fastest response
- **Email**: Monitored during business hours
- **Phone**: For urgent matters only

We believe in proactive communication. You shouldn't have to chase us for updates."""
    },
    # Policy Category
    {
        "category": "policy",
        "title": "Understanding Your Insurance Policy",
        "order": 1,
        "icon": "file-text",
        "content": """## Key Policy Terms Explained

### Coverage Types
- **Dwelling Coverage**: Covers your home's structure
- **Personal Property**: Covers your belongings
- **Loss of Use**: Covers living expenses if displaced

### Important Numbers
- **Deductible**: What you pay before insurance kicks in
- **Coverage Limit**: Maximum the policy will pay
- **Depreciation**: Reduction for age/wear of items

### What's Typically Covered
✅ Wind and hail damage
✅ Fire and smoke damage
✅ Water damage (sudden/accidental)
✅ Theft and vandalism

### What's Usually NOT Covered
❌ Flood damage (requires separate policy)
❌ Earthquake damage
❌ Normal wear and tear
❌ Maintenance issues

**Have questions about your specific policy?** Send us a message through the portal."""
    },
    # Documents Category
    {
        "category": "documents",
        "title": "Documents We Need From You",
        "order": 1,
        "icon": "folder",
        "content": """## Your Document Checklist

### Required Documents
- [ ] Copy of your insurance policy declarations page
- [ ] Photos of damage (we'll also take professional photos)
- [ ] List of damaged personal property (if applicable)
- [ ] Receipts for emergency repairs
- [ ] Previous inspection reports (if available)

### Helpful But Optional
- [ ] Original purchase receipts for damaged items
- [ ] Home improvement records
- [ ] Previous claims documentation
- [ ] Contractor estimates (if you have them)

### How to Submit
1. Log into your client portal
2. Go to "My Documents"
3. Upload files directly
4. We'll confirm receipt within 24 hours

**Tip:** The more documentation you provide, the stronger your claim."""
    },
    # FAQ Category
    {
        "category": "faq",
        "title": "Frequently Asked Questions",
        "order": 1,
        "icon": "help-circle",
        "content": """## Common Questions Answered

### About the Process

**Q: How long will my claim take?**
A: Most claims resolve within 8-12 weeks. Complex claims may take longer. We'll give you a realistic timeline based on your specific situation.

**Q: Do I need to be home for the inspection?**
A: We prefer you're present, but it's not required. We can work with a trusted representative if needed.

**Q: Can I start repairs before the claim settles?**
A: Emergency repairs to prevent further damage are fine. Document everything with photos and save receipts. Major repairs should wait until we have carrier approval.

### About Costs

**Q: How much does your service cost?**
A: We work on contingency - you pay nothing unless we recover money for you. Our fee is a percentage of the settlement.

**Q: Will using a public adjuster increase my settlement?**
A: Studies show policyholders represented by public adjusters typically receive 30-50% higher settlements than those who go alone.

**Q: What if my claim is denied?**
A: We'll review the denial, gather additional documentation, and file an appeal if warranted. Many initial denials are overturned.

### About Communication

**Q: How often will I hear from you?**
A: At minimum, weekly. More often when there's activity on your claim.

**Q: Who is my main point of contact?**
A: You'll have a dedicated adjuster assigned to your claim. Their contact info is in your portal."""
    },
    # Communication Standards
    {
        "category": "communication",
        "title": "Our Commitment to You",
        "order": 1,
        "icon": "shield",
        "content": """## Our Service Standards

### We Promise To:
✓ **Respond within 24 hours** to any message
✓ **Explain everything** in plain language, not insurance jargon
✓ **Be honest** about timelines and expectations
✓ **Fight for you** - your interests come first
✓ **Keep you informed** proactively, not reactively

### What We Expect From You:
- Respond to our requests within 48-72 hours when possible
- Provide accurate information about your damage
- Don't sign anything from the carrier without consulting us
- Ask questions - there are no dumb questions

### Our Values
**Stewardship**: We treat your claim like it's our own family's home
**Excellence**: "Good enough" is never good enough
**Clarity**: Simple, clear communication always

### If We Fall Short
We're human and sometimes make mistakes. If you ever feel underserved:
1. Message your adjuster directly
2. Escalate to management through the portal
3. We'll make it right

**Your trust is our most valuable asset.**"""
    }
]

DEFAULT_GLOSSARY = [
    {"term": "Actual Cash Value (ACV)", "definition": "The replacement cost minus depreciation. What your item is worth today, not what you paid for it.", "category": "insurance"},
    {"term": "Replacement Cost Value (RCV)", "definition": "The cost to replace damaged property with new items of similar kind and quality, without deduction for depreciation.", "category": "insurance"},
    {"term": "Deductible", "definition": "The amount you pay out of pocket before your insurance coverage kicks in.", "category": "insurance"},
    {"term": "Depreciation", "definition": "The decrease in value of property due to age, wear, and tear.", "category": "insurance"},
    {"term": "Claim", "definition": "A formal request to your insurance company for coverage or compensation for a covered loss.", "category": "claims"},
    {"term": "Public Adjuster", "definition": "A licensed professional who represents YOU (the policyholder) in preparing, filing, and negotiating insurance claims. We work for you, not the insurance company.", "category": "claims"},
    {"term": "Carrier Adjuster", "definition": "An adjuster employed by or contracted by the insurance company. They represent the carrier's interests.", "category": "claims"},
    {"term": "Scope of Work", "definition": "A detailed list of all repairs needed to restore your property to pre-loss condition.", "category": "claims"},
    {"term": "Supplement", "definition": "An additional claim filed when hidden damage is discovered or additional repairs are needed beyond the original estimate.", "category": "claims"},
    {"term": "Xactimate", "definition": "Industry-standard software used to create detailed repair estimates. Both we and insurance companies use it.", "category": "claims"},
    {"term": "Loss of Use", "definition": "Coverage for additional living expenses if you can't live in your home during repairs.", "category": "insurance"},
    {"term": "Subrogation", "definition": "When your insurance company seeks reimbursement from a third party responsible for your loss.", "category": "insurance"},
    {"term": "Proof of Loss", "definition": "A formal sworn statement documenting the facts of your loss and the amount you're claiming.", "category": "claims"},
    {"term": "Appraisal", "definition": "A dispute resolution process where both parties hire appraisers to determine the amount of loss.", "category": "claims"},
    {"term": "Mitigation", "definition": "Steps taken to prevent further damage after a loss occurs (like covering a hole in the roof).", "category": "claims"},
]


# ============ ENDPOINTS ============

@router.get("/articles")
async def get_education_articles(
    category: Optional[str] = None
):
    """Get all published education articles (public endpoint for clients)"""
    query = {"is_published": True}
    if category:
        query["category"] = category
    
    articles = await db.client_education_articles.find(
        query, 
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    # If no articles exist, seed the defaults
    if not articles:
        for article in DEFAULT_ARTICLES:
            article["id"] = str(uuid.uuid4())
            article["is_published"] = True
            article["created_at"] = datetime.now(timezone.utc).isoformat()
            article["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.client_education_articles.insert_one(article)
        
        articles = await db.client_education_articles.find(
            query,
            {"_id": 0}
        ).sort("order", 1).to_list(100)
    
    return {"articles": articles}


@router.get("/articles/{article_id}")
async def get_article(article_id: str):
    """Get a specific education article"""
    article = await db.client_education_articles.find_one(
        {"id": article_id, "is_published": True},
        {"_id": 0}
    )
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return article


@router.get("/glossary")
async def get_glossary(category: Optional[str] = None):
    """Get glossary terms"""
    query = {}
    if category:
        query["category"] = category
    
    terms = await db.client_glossary.find(query, {"_id": 0}).sort("term", 1).to_list(200)
    
    # Seed defaults if empty
    if not terms:
        for term in DEFAULT_GLOSSARY:
            term["id"] = str(uuid.uuid4())
            await db.client_glossary.insert_one(term)
        
        terms = await db.client_glossary.find(query, {"_id": 0}).sort("term", 1).to_list(200)
    
    return {"terms": terms}


@router.get("/categories")
async def get_categories():
    """Get all content categories with counts"""
    categories = [
        {"id": "timeline", "name": "Timeline & Process", "icon": "calendar", "description": "What to expect and when"},
        {"id": "policy", "name": "Understanding Your Policy", "icon": "file-text", "description": "Policy terms explained"},
        {"id": "documents", "name": "Documents Needed", "icon": "folder", "description": "What we need from you"},
        {"id": "faq", "name": "FAQs", "icon": "help-circle", "description": "Common questions answered"},
        {"id": "communication", "name": "Our Standards", "icon": "shield", "description": "What to expect from us"},
        {"id": "glossary", "name": "Glossary", "icon": "book", "description": "Insurance terms defined"},
    ]
    
    # Get counts for each category
    for cat in categories:
        if cat["id"] == "glossary":
            count = await db.client_glossary.count_documents({})
        else:
            count = await db.client_education_articles.count_documents({"category": cat["id"], "is_published": True})
        cat["count"] = count
    
    return {"categories": categories}


# ============ CLIENT QUESTIONS ============

@router.post("/questions")
async def submit_question(
    question: str,
    category: str = "general",
    claim_id: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Submit a question (client only)"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    q = ClientQuestion(
        client_id=user_id,
        client_name=current_user.get("full_name") or current_user.get("name", ""),
        client_email=current_user.get("email", ""),
        claim_id=claim_id,
        question=question,
        category=category
    )
    
    await db.client_questions.insert_one(q.model_dump())
    
    return {"id": q.id, "message": "Question submitted. We'll respond within 24 hours."}


@router.get("/questions/my")
async def get_my_questions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get client's own questions"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    questions = await db.client_questions.find(
        {"client_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"questions": questions}


@router.get("/questions/pending")
async def get_pending_questions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all pending questions (staff only)"""
    if current_user.get("role") not in ["admin", "manager", "adjuster"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    
    questions = await db.client_questions.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"questions": questions}


@router.put("/questions/{question_id}/answer")
async def answer_question(
    question_id: str,
    answer: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Answer a client question (staff only)"""
    if current_user.get("role") not in ["admin", "manager", "adjuster"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    
    result = await db.client_questions.update_one(
        {"id": question_id},
        {"$set": {
            "answer": answer,
            "answered_by": current_user.get("email", ""),
            "answered_at": datetime.now(timezone.utc).isoformat(),
            "status": "answered"
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    
    return {"message": "Question answered"}


# ============ ADMIN ENDPOINTS ============

@router.post("/articles", tags=["admin"])
async def create_article(
    article: EducationArticle,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new education article (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.client_education_articles.insert_one(article.model_dump())
    return {"id": article.id, "message": "Article created"}


@router.put("/articles/{article_id}", tags=["admin"])
async def update_article(
    article_id: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
    is_published: Optional[bool] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Update an education article (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if title:
        update_data["title"] = title
    if content:
        update_data["content"] = content
    if is_published is not None:
        update_data["is_published"] = is_published
    
    result = await db.client_education_articles.update_one(
        {"id": article_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return {"message": "Article updated"}
