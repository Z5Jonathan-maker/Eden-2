"""
Interactive Vision Board - Personal growth and team inspiration
Daily journal, gratitude, goals, and visual vision board
"""
import uuid
import os
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field
from dependencies import db, get_current_active_user

router = APIRouter(prefix="/api/vision-board", tags=["vision-board"])

import pathlib

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/eden_uploads")
pathlib.Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


# ============ MODELS ============

class JournalEntry(BaseModel):
    """Daily journal entry"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    date: str  # YYYY-MM-DD
    
    # Journal content
    thoughts: Optional[str] = None
    gratitude: List[str] = []  # What I'm grateful for
    beliefs: List[str] = []  # What I'm believing for
    wins: List[str] = []  # Today's wins
    goals_today: List[str] = []  # What I'm working on today
    
    # Mood/energy tracking
    mood: Optional[str] = None  # great, good, okay, challenging, tough
    energy_level: Optional[int] = None  # 1-10
    
    # Sharing settings
    is_shared: bool = False  # Share with team
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class VisionItem(BaseModel):
    """Personal vision board item"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    
    # Vision content
    category: str  # faith, family, finances, fitness, career, personal, other
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    affirmation: Optional[str] = None
    target_date: Optional[str] = None
    
    # Status
    is_achieved: bool = False
    achieved_at: Optional[str] = None
    
    # Display
    position: Optional[dict] = None  # {x, y} for board layout
    color: Optional[str] = None
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Milestone(BaseModel):
    """Achievement/milestone"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    
    title: str
    description: Optional[str] = None
    category: str  # personal, professional, team, client
    achieved_date: str
    
    is_shared: bool = True
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TeamPost(BaseModel):
    """Shared team inspiration post"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    
    content: str
    post_type: str  # gratitude, win, encouragement, milestone, quote
    
    likes: List[str] = []  # User IDs who liked
    
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============ JOURNAL ENDPOINTS ============

@router.post("/journal")
async def create_journal_entry(
    thoughts: Optional[str] = None,
    gratitude: List[str] = [],
    beliefs: List[str] = [],
    wins: List[str] = [],
    goals_today: List[str] = [],
    mood: Optional[str] = None,
    energy_level: Optional[int] = None,
    is_shared: bool = False,
    current_user: dict = Depends(get_current_active_user)
):
    """Create or update today's journal entry"""
    user_id = current_user.get("id") or current_user.get("sub")
    user_name = current_user.get("full_name") or current_user.get("name") or current_user.get("email", "")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check if entry exists for today
    existing = await db.vision_journal.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if existing:
        # Update existing entry
        await db.vision_journal.update_one(
            {"id": existing["id"]},
            {"$set": {
                "thoughts": thoughts,
                "gratitude": gratitude,
                "beliefs": beliefs,
                "wins": wins,
                "goals_today": goals_today,
                "mood": mood,
                "energy_level": energy_level,
                "is_shared": is_shared,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"id": existing["id"], "message": "Journal entry updated"}
    
    # Create new entry
    entry = JournalEntry(
        user_id=user_id,
        user_name=user_name,
        date=today,
        thoughts=thoughts,
        gratitude=gratitude,
        beliefs=beliefs,
        wins=wins,
        goals_today=goals_today,
        mood=mood,
        energy_level=energy_level,
        is_shared=is_shared
    )
    
    await db.vision_journal.insert_one(entry.model_dump())
    return {"id": entry.id, "message": "Journal entry created"}


@router.get("/journal/today")
async def get_today_journal(
    current_user: dict = Depends(get_current_active_user)
):
    """Get today's journal entry"""
    user_id = current_user.get("id") or current_user.get("sub")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    entry = await db.vision_journal.find_one(
        {"user_id": user_id, "date": today},
        {"_id": 0}
    )
    
    return {"entry": entry}


@router.get("/journal/history")
async def get_journal_history(
    days: int = 30,
    current_user: dict = Depends(get_current_active_user)
):
    """Get journal entries for the past N days"""
    user_id = current_user.get("id") or current_user.get("sub")
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    
    entries = await db.vision_journal.find(
        {"user_id": user_id, "date": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("date", -1).to_list(days)
    
    # Calculate streaks and stats
    dates_with_entries = set(e["date"] for e in entries)
    
    # Current streak
    streak = 0
    check_date = datetime.now(timezone.utc)
    while check_date.strftime("%Y-%m-%d") in dates_with_entries:
        streak += 1
        check_date -= timedelta(days=1)
    
    return {
        "entries": entries,
        "stats": {
            "total_entries": len(entries),
            "current_streak": streak,
            "days_this_month": len([e for e in entries if e["date"][:7] == datetime.now(timezone.utc).strftime("%Y-%m")])
        }
    }


# ============ VISION BOARD ENDPOINTS ============

@router.post("/items")
async def create_vision_item(
    category: str,
    title: str,
    description: Optional[str] = None,
    affirmation: Optional[str] = None,
    target_date: Optional[str] = None,
    color: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a vision board item"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    item = VisionItem(
        user_id=user_id,
        category=category,
        title=title,
        description=description,
        affirmation=affirmation,
        target_date=target_date,
        color=color
    )
    
    await db.vision_items.insert_one(item.model_dump())
    return {"id": item.id, "message": "Vision item created"}


@router.post("/items/{item_id}/image")
async def upload_vision_image(
    item_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload an image for a vision board item"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    # Verify ownership
    item = await db.vision_items.find_one({"id": item_id, "user_id": user_id})
    if not item:
        raise HTTPException(status_code=404, detail="Vision item not found")
    
    # Save file
    file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    file_name = f"{item_id}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, file_name)
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Update item with image URL
    image_url = f"/api/vision-board/images/{file_name}"
    await db.vision_items.update_one(
        {"id": item_id},
        {"$set": {"image_url": image_url}}
    )
    
    return {"image_url": image_url}


@router.get("/images/{filename}")
async def get_vision_image(filename: str):
    """Serve vision board images"""
    from fastapi.responses import FileResponse
    
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    return FileResponse(file_path)


@router.get("/items")
async def get_vision_items(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's vision board items"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    query = {"user_id": user_id}
    if category:
        query["category"] = category
    
    items = await db.vision_items.find(query, {"_id": 0}).to_list(100)
    
    # Group by category
    by_category = {}
    for item in items:
        cat = item.get("category", "other")
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(item)
    
    return {
        "items": items,
        "by_category": by_category,
        "categories": [
            {"id": "faith", "name": "Faith & Spirituality", "icon": "heart", "color": "#8B5CF6"},
            {"id": "family", "name": "Family & Relationships", "icon": "users", "color": "#EC4899"},
            {"id": "finances", "name": "Finances & Wealth", "icon": "dollar-sign", "color": "#10B981"},
            {"id": "fitness", "name": "Health & Fitness", "icon": "activity", "color": "#F59E0B"},
            {"id": "career", "name": "Career & Business", "icon": "briefcase", "color": "#3B82F6"},
            {"id": "personal", "name": "Personal Growth", "icon": "target", "color": "#6366F1"},
            {"id": "other", "name": "Other Dreams", "icon": "star", "color": "#6B7280"}
        ]
    }


@router.put("/items/{item_id}")
async def update_vision_item(
    item_id: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    affirmation: Optional[str] = None,
    target_date: Optional[str] = None,
    is_achieved: Optional[bool] = None,
    position: Optional[dict] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a vision board item"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    update_data = {}
    if title:
        update_data["title"] = title
    if description:
        update_data["description"] = description
    if affirmation:
        update_data["affirmation"] = affirmation
    if target_date:
        update_data["target_date"] = target_date
    if position:
        update_data["position"] = position
    if is_achieved is not None:
        update_data["is_achieved"] = is_achieved
        if is_achieved:
            update_data["achieved_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.vision_items.update_one(
        {"id": item_id, "user_id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vision item not found")
    
    return {"message": "Vision item updated"}


@router.delete("/items/{item_id}")
async def delete_vision_item(
    item_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a vision board item"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    result = await db.vision_items.delete_one({"id": item_id, "user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vision item not found")
    
    return {"message": "Vision item deleted"}


# ============ MILESTONES ============

@router.post("/milestones")
async def create_milestone(
    title: str,
    description: Optional[str] = None,
    category: str = "personal",
    achieved_date: Optional[str] = None,
    is_shared: bool = True,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a milestone/achievement"""
    user_id = current_user.get("id") or current_user.get("sub")
    user_name = current_user.get("full_name") or current_user.get("name") or current_user.get("email", "")
    
    milestone = Milestone(
        user_id=user_id,
        user_name=user_name,
        title=title,
        description=description,
        category=category,
        achieved_date=achieved_date or datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        is_shared=is_shared
    )
    
    await db.vision_milestones.insert_one(milestone.model_dump())
    return {"id": milestone.id, "message": "Milestone created"}


@router.get("/milestones")
async def get_milestones(
    current_user: dict = Depends(get_current_active_user)
):
    """Get user's milestones"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    milestones = await db.vision_milestones.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("achieved_date", -1).to_list(50)
    
    return {"milestones": milestones}


# ============ TEAM FEED ============

@router.post("/team/post")
async def create_team_post(
    content: str,
    post_type: str = "encouragement",
    current_user: dict = Depends(get_current_active_user)
):
    """Create a team inspiration post"""
    user_id = current_user.get("id") or current_user.get("sub")
    user_name = current_user.get("full_name") or current_user.get("name") or current_user.get("email", "")
    
    post = TeamPost(
        user_id=user_id,
        user_name=user_name,
        content=content,
        post_type=post_type
    )
    
    await db.vision_team_posts.insert_one(post.model_dump())
    return {"id": post.id, "message": "Post shared with team"}


@router.get("/team/feed")
async def get_team_feed(
    days: int = 7,
    current_user: dict = Depends(get_current_active_user)
):
    """Get team inspiration feed"""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Get team posts
    posts = await db.vision_team_posts.find(
        {"created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Get shared journal entries (gratitude/wins only)
    shared_entries = await db.vision_journal.find(
        {"is_shared": True, "created_at": {"$gte": cutoff}},
        {"_id": 0, "thoughts": 0}  # Don't expose private thoughts
    ).sort("created_at", -1).to_list(20)
    
    # Get shared milestones
    milestones = await db.vision_milestones.find(
        {"is_shared": True, "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    
    return {
        "posts": posts,
        "shared_gratitude": shared_entries,
        "milestones": milestones
    }


@router.post("/team/post/{post_id}/like")
async def like_post(
    post_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Like a team post"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    # Toggle like
    post = await db.vision_team_posts.find_one({"id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get("likes", [])
    if user_id in likes:
        likes.remove(user_id)
        action = "unliked"
    else:
        likes.append(user_id)
        action = "liked"
    
    await db.vision_team_posts.update_one(
        {"id": post_id},
        {"$set": {"likes": likes}}
    )
    
    return {"action": action, "likes_count": len(likes)}


# ============ STATS & INSIGHTS ============

@router.get("/stats")
async def get_vision_stats(
    current_user: dict = Depends(get_current_active_user)
):
    """Get personal vision board statistics"""
    user_id = current_user.get("id") or current_user.get("sub")
    
    # Vision items stats
    total_items = await db.vision_items.count_documents({"user_id": user_id})
    achieved_items = await db.vision_items.count_documents({"user_id": user_id, "is_achieved": True})
    
    # Journal stats
    total_entries = await db.vision_journal.count_documents({"user_id": user_id})
    
    # Current streak calculation
    entries = await db.vision_journal.find(
        {"user_id": user_id},
        {"date": 1}
    ).sort("date", -1).to_list(100)
    
    streak = 0
    if entries:
        check_date = datetime.now(timezone.utc)
        dates = set(e["date"] for e in entries)
        while check_date.strftime("%Y-%m-%d") in dates:
            streak += 1
            check_date -= timedelta(days=1)
    
    # Milestones
    milestones_count = await db.vision_milestones.count_documents({"user_id": user_id})
    
    return {
        "vision_items": {
            "total": total_items,
            "achieved": achieved_items,
            "in_progress": total_items - achieved_items
        },
        "journal": {
            "total_entries": total_entries,
            "current_streak": streak
        },
        "milestones": milestones_count
    }
