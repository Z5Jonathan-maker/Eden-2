"""
MyCard - Digital Business Card System
Each user can have their own customizable digital business card with:
- Profile photo, name, title, company
- QR code for sharing
- Contact info (phone, email)
- About me bio
- Gallery images
- Reviews/Ratings
- Analytics (views, shares, open rates)
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone
import uuid
import qrcode
import io
import base64

from dependencies import db, get_current_active_user as get_current_user

router = APIRouter(prefix="/api/mycard", tags=["MyCard - Digital Business Card"])


# ============================================
# Models
# ============================================

class SocialLink(BaseModel):
    platform: str  # linkedin, twitter, instagram, facebook, youtube, tiktok, website
    url: str
    label: Optional[str] = None


class MyCardProfile(BaseModel):
    user_id: str
    full_name: str
    title: str = "Field Representative"
    company: str = "Care Claims"
    company_logo_url: Optional[str] = None
    profile_photo_url: Optional[str] = None
    cover_photo_url: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    tagline: Optional[str] = None
    social_links: List[SocialLink] = []
    gallery_images: List[str] = []
    is_public: bool = True
    card_style: str = "tactical"  # tactical, professional, minimal, dark
    accent_color: str = "#f97316"  # orange-500
    slug: Optional[str] = None  # unique URL slug for sharing
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CardAnalytics(BaseModel):
    card_id: str
    total_views: int = 0
    unique_visitors: int = 0
    qr_scans: int = 0
    link_clicks: Dict[str, int] = {}  # phone_click, email_click, social_link clicks
    shares: int = 0
    last_viewed: Optional[datetime] = None


class Review(BaseModel):
    id: str
    card_id: str
    reviewer_name: str
    reviewer_email: Optional[str] = None
    rating: int  # 1-5
    comment: str
    is_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CreateCardRequest(BaseModel):
    full_name: str
    title: Optional[str] = "Field Representative"
    company: Optional[str] = "Care Claims"
    phone: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    tagline: Optional[str] = None
    card_style: Optional[str] = "tactical"
    accent_color: Optional[str] = "#f97316"


class UpdateCardRequest(BaseModel):
    full_name: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    company_logo_url: Optional[str] = None
    profile_photo_url: Optional[str] = None
    cover_photo_url: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    bio: Optional[str] = None
    tagline: Optional[str] = None
    social_links: Optional[List[dict]] = None
    gallery_images: Optional[List[str]] = None
    is_public: Optional[bool] = None
    card_style: Optional[str] = None
    accent_color: Optional[str] = None


# ============================================
# Helper Functions
# ============================================

def generate_qr_code(url: str) -> str:
    """Generate QR code as base64 string"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def generate_unique_slug(full_name: str) -> str:
    """Generate a unique URL slug from name"""
    base_slug = full_name.lower().replace(' ', '-').replace('.', '')
    # Remove special characters
    base_slug = ''.join(c for c in base_slug if c.isalnum() or c == '-')
    return f"{base_slug}-{str(uuid.uuid4())[:8]}"


# ============================================
# Endpoints
# ============================================

@router.get("/me")
async def get_my_card(current_user: dict = Depends(get_current_user)):
    """Get the current user's business card"""
    user_id = current_user.get("id") or current_user.get("email")
    
    card = await db.mycards.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not card:
        return {"card": None, "has_card": False}
    
    # Generate QR code for the card URL
    card_url = f"/card/{card.get('slug', user_id)}"
    qr_code = generate_qr_code(card_url)
    
    # Get analytics
    analytics = await db.mycard_analytics.find_one(
        {"card_id": user_id},
        {"_id": 0}
    )
    
    # Get reviews
    reviews_cursor = db.mycard_reviews.find(
        {"card_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10)
    reviews = await reviews_cursor.to_list(length=10)
    
    # Calculate average rating
    avg_rating = 0
    if reviews:
        avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews)
    
    return {
        "card": card,
        "has_card": True,
        "qr_code": qr_code,
        "card_url": card_url,
        "analytics": analytics or {"total_views": 0, "shares": 0},
        "reviews": reviews,
        "average_rating": round(avg_rating, 1),
        "review_count": len(reviews)
    }


@router.post("/create")
async def create_card(
    request: CreateCardRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new digital business card"""
    user_id = current_user.get("id") or current_user.get("email")
    
    # Check if user already has a card
    existing = await db.mycards.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="You already have a business card. Use update instead.")
    
    # Generate unique slug
    slug = generate_unique_slug(request.full_name)
    
    # Create card document
    card_data = {
        "user_id": user_id,
        "full_name": request.full_name,
        "title": request.title or "Field Representative",
        "company": request.company or "Care Claims",
        "phone": request.phone or current_user.get("phone"),
        "email": request.email or current_user.get("email"),
        "bio": request.bio,
        "tagline": request.tagline,
        "card_style": request.card_style or "tactical",
        "accent_color": request.accent_color or "#f97316",
        "slug": slug,
        "social_links": [],
        "gallery_images": [],
        "is_public": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mycards.insert_one(card_data)
    
    # Initialize analytics
    await db.mycard_analytics.insert_one({
        "card_id": user_id,
        "total_views": 0,
        "unique_visitors": 0,
        "qr_scans": 0,
        "link_clicks": {},
        "shares": 0
    })
    
    # Remove _id before returning
    card_data.pop("_id", None)
    
    return {
        "success": True,
        "message": "Business card created successfully",
        "card": card_data,
        "card_url": f"/card/{slug}"
    }


@router.put("/update")
async def update_card(
    request: UpdateCardRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update business card details"""
    user_id = current_user.get("id") or current_user.get("email")
    
    # Check if card exists
    existing = await db.mycards.find_one({"user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Business card not found. Create one first.")
    
    # Build update dict
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.full_name is not None:
        update_data["full_name"] = request.full_name
    if request.title is not None:
        update_data["title"] = request.title
    if request.company is not None:
        update_data["company"] = request.company
    if request.company_logo_url is not None:
        update_data["company_logo_url"] = request.company_logo_url
    if request.profile_photo_url is not None:
        update_data["profile_photo_url"] = request.profile_photo_url
    if request.cover_photo_url is not None:
        update_data["cover_photo_url"] = request.cover_photo_url
    if request.phone is not None:
        update_data["phone"] = request.phone
    if request.email is not None:
        update_data["email"] = request.email
    if request.bio is not None:
        update_data["bio"] = request.bio
    if request.tagline is not None:
        update_data["tagline"] = request.tagline
    if request.social_links is not None:
        update_data["social_links"] = request.social_links
    if request.gallery_images is not None:
        update_data["gallery_images"] = request.gallery_images
    if request.is_public is not None:
        update_data["is_public"] = request.is_public
    if request.card_style is not None:
        update_data["card_style"] = request.card_style
    if request.accent_color is not None:
        update_data["accent_color"] = request.accent_color
    
    await db.mycards.update_one(
        {"user_id": user_id},
        {"$set": update_data}
    )
    
    # Get updated card
    updated_card = await db.mycards.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    return {
        "success": True,
        "message": "Business card updated successfully",
        "card": updated_card
    }


@router.get("/public/{slug}")
async def get_public_card(slug: str):
    """Get a public business card by slug (for sharing)"""
    card = await db.mycards.find_one(
        {"slug": slug, "is_public": True},
        {"_id": 0}
    )
    
    if not card:
        raise HTTPException(status_code=404, detail="Business card not found")
    
    # Track view
    await db.mycard_analytics.update_one(
        {"card_id": card["user_id"]},
        {
            "$inc": {"total_views": 1},
            "$set": {"last_viewed": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    # Get reviews
    reviews_cursor = db.mycard_reviews.find(
        {"card_id": card["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(5)
    reviews = await reviews_cursor.to_list(length=5)
    
    avg_rating = 0
    if reviews:
        avg_rating = sum(r.get("rating", 0) for r in reviews) / len(reviews)
    
    # Generate QR code
    card_url = f"/card/{slug}"
    qr_code = generate_qr_code(card_url)
    
    return {
        "card": card,
        "qr_code": qr_code,
        "reviews": reviews,
        "average_rating": round(avg_rating, 1),
        "review_count": len(reviews)
    }


@router.post("/track-click/{slug}")
async def track_link_click(slug: str, click_type: str):
    """Track when someone clicks a link on the card"""
    card = await db.mycards.find_one({"slug": slug})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    # Increment the specific click counter
    await db.mycard_analytics.update_one(
        {"card_id": card["user_id"]},
        {"$inc": {f"link_clicks.{click_type}": 1}},
        upsert=True
    )
    
    return {"success": True}


@router.post("/track-share/{slug}")
async def track_share(slug: str):
    """Track when someone shares the card"""
    card = await db.mycards.find_one({"slug": slug})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    await db.mycard_analytics.update_one(
        {"card_id": card["user_id"]},
        {"$inc": {"shares": 1}},
        upsert=True
    )
    
    return {"success": True}


@router.post("/reviews/{slug}")
async def add_review(
    slug: str,
    reviewer_name: str,
    rating: int,
    comment: str,
    reviewer_email: Optional[str] = None
):
    """Add a review to a business card"""
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    card = await db.mycards.find_one({"slug": slug})
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    
    review = {
        "id": str(uuid.uuid4()),
        "card_id": card["user_id"],
        "reviewer_name": reviewer_name,
        "reviewer_email": reviewer_email,
        "rating": rating,
        "comment": comment,
        "is_verified": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mycard_reviews.insert_one(review)
    review.pop("_id", None)
    
    return {"success": True, "review": review}


@router.get("/analytics")
async def get_card_analytics(current_user: dict = Depends(get_current_user)):
    """Get analytics for the current user's card"""
    user_id = current_user.get("id") or current_user.get("email")
    
    analytics = await db.mycard_analytics.find_one(
        {"card_id": user_id},
        {"_id": 0}
    )
    
    if not analytics:
        return {
            "total_views": 0,
            "unique_visitors": 0,
            "qr_scans": 0,
            "link_clicks": {},
            "shares": 0
        }
    
    return analytics


@router.delete("/")
async def delete_card(current_user: dict = Depends(get_current_user)):
    """Delete the current user's business card"""
    user_id = current_user.get("id") or current_user.get("email")
    
    result = await db.mycards.delete_one({"user_id": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Business card not found")
    
    # Also delete analytics and reviews
    await db.mycard_analytics.delete_one({"card_id": user_id})
    await db.mycard_reviews.delete_many({"card_id": user_id})
    
    return {"success": True, "message": "Business card deleted"}


@router.get("/team")
async def get_team_cards(current_user: dict = Depends(get_current_user)):
    """Get all team member business cards (admin feature)"""
    cards = await db.mycards.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    result = []
    for card in cards:
        analytics = await db.mycard_analytics.find_one(
            {"card_id": card["user_id"]}, {"_id": 0}
        )
        result.append({
            "card": card,
            "analytics": analytics or {"total_views": 0, "shares": 0}
        })
    
    return {"team_cards": result, "total": len(result)}


@router.post("/share-link")
async def generate_share_link(current_user: dict = Depends(get_current_user)):
    """Generate a shareable link for the current user's card"""
    user_id = current_user.get("id") or current_user.get("email")
    card = await db.mycards.find_one({"user_id": user_id}, {"_id": 0})
    
    if not card:
        raise HTTPException(status_code=404, detail="No card found. Create one first.")
    
    slug = card.get("slug", user_id)
    base_url = "https://mycard-military.preview.emergentagent.com"
    share_url = f"{base_url}/card/{slug}"
    
    # Track share
    await db.mycard_analytics.update_one(
        {"card_id": user_id},
        {"$inc": {"shares": 1}},
        upsert=True
    )
    
    return {
        "share_url": share_url,
        "slug": slug,
        "message": f"Share this link: {share_url}"
    }

