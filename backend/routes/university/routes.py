'''
University API Routes

Educational content management for insurance professionals.
Courses, lessons, articles, quizzes, progress tracking, and certificates.
'''

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone

from dependencies import db, get_current_active_user
from .models import (
    QuizQuestion, Lesson, Course, Article,
    UserProgress, Certificate, QuizSubmission, LessonComplete
)
from .seed_data import seed_university_data

router = APIRouter(prefix="/api/university", tags=["University"])

@router.get("/courses")
async def get_courses(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    query = {"is_published": True}
    if category:
        query["category"] = category
    
    courses = await db.courses.find(query, {"_id": 0}).to_list(100)
    
    for course in courses:
        progress = await db.user_progress.find_one(
            {"user_id": current_user["id"], "course_id": course["id"]},
            {"_id": 0}
        )
        course["user_progress"] = progress
    
    return courses

@router.get("/courses/{course_id}")
async def get_course(course_id: str, current_user: dict = Depends(get_current_active_user)):
    course = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    progress = await db.user_progress.find_one(
        {"user_id": current_user["id"], "course_id": course_id},
        {"_id": 0}
    )
    course["user_progress"] = progress
    return course

@router.get("/articles")
async def get_articles(
    category: Optional[str] = None,
    tag: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    query = {"is_published": True}
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    
    articles = await db.articles.find(query, {"_id": 0}).to_list(100)
    return articles

@router.get("/articles/{article_id}")
async def get_article(article_id: str, current_user: dict = Depends(get_current_active_user)):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article

@router.get("/search")
async def search_content(q: str = Query(..., min_length=2), current_user: dict = Depends(get_current_active_user)):
    search_regex = {"$regex": q, "$options": "i"}
    
    courses = await db.courses.find(
        {"$or": [{"title": search_regex}, {"description": search_regex}], "is_published": True},
        {"_id": 0, "lessons": 0, "quiz": 0}
    ).to_list(20)
    
    articles = await db.articles.find(
        {"$or": [{"title": search_regex}, {"description": search_regex}, {"content": search_regex}, {"tags": search_regex}], "is_published": True},
        {"_id": 0, "content": 0}
    ).to_list(20)
    
    return {"courses": courses, "articles": articles, "total": len(courses) + len(articles)}

@router.post("/progress/lesson")
async def complete_lesson(data: LessonComplete, current_user: dict = Depends(get_current_active_user)):
    progress = await db.user_progress.find_one({"user_id": current_user["id"], "course_id": data.course_id})
    
    if not progress:
        progress = UserProgress(user_id=current_user["id"], course_id=data.course_id, completed_lessons=[data.lesson_id]).dict()
        await db.user_progress.insert_one(progress)
    else:
        if data.lesson_id not in progress.get("completed_lessons", []):
            await db.user_progress.update_one(
                {"user_id": current_user["id"], "course_id": data.course_id},
                {"$push": {"completed_lessons": data.lesson_id}}
            )
    
    course = await db.courses.find_one({"id": data.course_id})
    if course:
        total_lessons = len(course.get("lessons", []))
        updated_progress = await db.user_progress.find_one({"user_id": current_user["id"], "course_id": data.course_id})
        completed_count = len(updated_progress.get("completed_lessons", []))
        return {"success": True, "completed_lessons": completed_count, "total_lessons": total_lessons, "course_complete": completed_count >= total_lessons}
    
    return {"success": True}

@router.post("/quiz/submit")
async def submit_quiz(submission: QuizSubmission, current_user: dict = Depends(get_current_active_user)):
    from incentives_engine.events import emit_university_event
    
    course = await db.courses.find_one({"id": submission.course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    quiz = course.get("quiz", [])
    if not quiz:
        raise HTTPException(status_code=400, detail="This course has no quiz")
    
    correct = 0
    total = len(quiz)
    
    for i, question in enumerate(quiz):
        if i < len(submission.answers) and submission.answers[i] == question["correct_answer"]:
            correct += 1
    
    score = int((correct / total) * 100)
    passed = score >= 70
    
    await db.user_progress.update_one(
        {"user_id": current_user["id"], "course_id": submission.course_id},
        {"$set": {"quiz_score": score, "quiz_passed": passed, "completed_at": datetime.now(timezone.utc).isoformat() if passed else None}},
        upsert=True
    )
    
    certificate = None
    if passed:
        existing_cert = await db.certificates.find_one({"user_id": current_user["id"], "course_id": submission.course_id})
        if not existing_cert:
            certificate = Certificate(
                user_id=current_user["id"],
                user_name=current_user.get("full_name", "User"),
                course_id=submission.course_id,
                course_title=course["title"]
            )
            await db.certificates.insert_one(certificate.dict())
            certificate = certificate.dict()
            
            # Emit game event for course completion
            try:
                await emit_university_event(
                    db=db,
                    user_id=current_user["id"],
                    event_type="university.course_completed",
                    course_id=submission.course_id,
                    progress_percent=100
                )
                logger.info(f"University course completion event emitted for user {current_user['id']}, course {submission.course_id}")
            except Exception as e:
                logger.error(f"Failed to emit university course completion event: {e}")
                # Don't fail the request if event emission fails
    
    return {"score": score, "correct": correct, "total": total, "passed": passed, "certificate": certificate}

@router.get("/progress")
async def get_user_progress(current_user: dict = Depends(get_current_active_user)):
    progress = await db.user_progress.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return progress

@router.get("/certificates")
async def get_certificates(current_user: dict = Depends(get_current_active_user)):
    certificates = await db.certificates.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(100)
    return certificates

@router.get("/certificates/{certificate_id}")
async def get_certificate(certificate_id: str, current_user: dict = Depends(get_current_active_user)):
    certificate = await db.certificates.find_one({"id": certificate_id, "user_id": current_user["id"]}, {"_id": 0})
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return certificate

@router.get("/stats")
async def get_university_stats(current_user: dict = Depends(get_current_active_user)):
    completed_courses = await db.user_progress.count_documents({"user_id": current_user["id"], "quiz_passed": True})
    certificates = await db.certificates.count_documents({"user_id": current_user["id"]})
    in_progress = await db.user_progress.count_documents({"user_id": current_user["id"], "quiz_passed": {"$ne": True}})
    total_courses = await db.courses.count_documents({"is_published": True})
    
    return {"completed_courses": completed_courses, "in_progress": in_progress, "certificates": certificates, "total_courses": total_courses}

# Approved YouTube Content Sources
APPROVED_VIDEO_SOURCES = [
    {
        "id": "john_senac",
        "name": "John Senac",
        "category": "primary",
        "description": "Carrier behavior analysis, delay tactics, leverage strategy, real-world claim psychology.",
        "search_terms": ["John Senac insurance claims", "John Senac public adjuster", "John Senac moving goalposts", "John Senac carrier tactics"],
        "topics": ["carrier_tactics", "leverage", "psychology"],
        "trust_level": "high"
    },
    {
        "id": "listen_to_this_bull",
        "name": "Matthew Mullohand - Listen To This Bull",
        "category": "primary",
        "description": "No fluff, practical claim handling, straight talk that matches homeowner advocacy.",
        "search_terms": ["Listen To This Bull insurance", "Matthew Mullohand insurance claims", "Listen To This Bull public adjuster", "Mullohand insurance podcast clips"],
        "topics": ["practical", "field_tested", "no_nonsense"],
        "trust_level": "high"
    },
    {
        "id": "vince_perri",
        "name": "Vince Perri",
        "category": "primary",
        "description": "Concise, execution-focused, zero hype. Great for tactical learning.",
        "search_terms": ["Vince Perri public adjuster", "Vince Perri insurance claims", "Vince Perri adjusting tips", "Vince Perri claims handling"],
        "topics": ["execution", "tactical", "concise"],
        "trust_level": "high"
    },
    {
        "id": "merlin_law",
        "name": "Merlin Law Group / Chip Merlin",
        "category": "primary",
        "description": "Policy interpretation, bad faith principles, legal grounding without carrier spin.",
        "search_terms": ["Merlin Law Group insurance claims", "Chip Merlin insurance law", "Merlin Law bad faith insurance", "Merlin Law property insurance"],
        "topics": ["policy", "bad_faith", "legal"],
        "trust_level": "high"
    },
    {
        "id": "parrot_key",
        "name": "Parrot Key",
        "category": "secondary",
        "description": "Good supplemental education - useful when filtered through Care Claims doctrine.",
        "search_terms": ["Parrot Key insurance claims", "Parrot Key public adjuster", "Parrot Key insurance education"],
        "topics": ["education", "supplemental"],
        "trust_level": "medium"
    }
]

VIDEO_PLAYLISTS = [
    {"id": "carrier_tactics", "name": "Understanding Carrier Tactics", "description": "Learn to recognize and counter carrier delay tactics.", "sources": ["john_senac", "listen_to_this_bull"], "search_query": "insurance carrier tactics delay deny"},
    {"id": "supplements", "name": "Supplement Strategy", "description": "Master the supplement process.", "sources": ["vince_perri", "listen_to_this_bull"], "search_query": "insurance supplement claim"},
    {"id": "bad_faith", "name": "Bad Faith Recognition", "description": "Identify bad faith indicators.", "sources": ["merlin_law", "john_senac"], "search_query": "insurance bad faith"},
    {"id": "policy_interpretation", "name": "Policy Language", "description": "Understand coverage triggers and exclusions.", "sources": ["merlin_law"], "search_query": "insurance policy interpretation"},
    {"id": "florida_specific", "name": "Florida Claims", "description": "Florida-specific regulations and hurricane claims.", "sources": ["merlin_law", "vince_perri"], "search_query": "Florida insurance claims"}
]

@router.get("/video-sources")
async def get_approved_video_sources(current_user: dict = Depends(get_current_active_user)):
    return {"sources": APPROVED_VIDEO_SOURCES, "playlists": VIDEO_PLAYLISTS}

@router.get("/video-sources/{source_id}")
async def get_video_source(source_id: str, current_user: dict = Depends(get_current_active_user)):
    for source in APPROVED_VIDEO_SOURCES:
        if source["id"] == source_id:
            return source
    raise HTTPException(status_code=404, detail="Source not found")

@router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: str, current_user: dict = Depends(get_current_active_user)):
    for playlist in VIDEO_PLAYLISTS:
        if playlist["id"] == playlist_id:
            return playlist
    raise HTTPException(status_code=404, detail="Playlist not found")



# ========== CUSTOM CONTENT MANAGEMENT (Firm-Specific) ==========

class CustomCourseCreate(BaseModel):
    title: str
    description: str
    category: str = "custom"
    thumbnail: Optional[str] = None
    lessons: List[Lesson] = []
    is_published: bool = False

class CustomArticleCreate(BaseModel):
    title: str
    description: str
    content: str
    category: str = "custom"
    tags: List[str] = []
    is_published: bool = False

class CustomDocumentCreate(BaseModel):
    title: str
    description: str
    doc_type: str  # "sop", "strategy", "template", "policy", "other"
    content: str
    tags: List[str] = []
    is_published: bool = False

class CustomDocument(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    doc_type: str
    content: str
    tags: List[str] = []
    author_id: str = ""
    author_name: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None
    is_published: bool = False
    is_custom: bool = True


@router.post("/custom/courses")
async def create_custom_course(
    course_data: CustomCourseCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a custom firm-specific course (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can create custom content")
    
    course = Course(
        title=course_data.title,
        description=course_data.description,
        category=course_data.category,
        thumbnail=course_data.thumbnail,
        lessons=course_data.lessons,
        is_published=course_data.is_published
    )
    
    course_dict = course.model_dump()
    course_dict["is_custom"] = True
    course_dict["created_by"] = current_user.get("email", "unknown")
    course_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.courses.insert_one(course_dict)
    
    return {"id": course.id, "message": "Custom course created successfully"}


@router.put("/custom/courses/{course_id}")
async def update_custom_course(
    course_id: str,
    course_data: CustomCourseCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a custom course (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can edit custom content")
    
    existing = await db.courses.find_one({"id": course_id, "is_custom": True})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom course not found")
    
    update_data = course_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")
    
    await db.courses.update_one({"id": course_id}, {"$set": update_data})
    return {"message": "Course updated successfully"}


@router.delete("/custom/courses/{course_id}")
async def delete_custom_course(
    course_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a custom course (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete custom content")
    
    result = await db.courses.delete_one({"id": course_id, "is_custom": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom course not found")
    
    return {"message": "Course deleted successfully"}


@router.post("/custom/articles")
async def create_custom_article(
    article_data: CustomArticleCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a custom firm-specific article (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can create custom content")
    
    article = Article(
        title=article_data.title,
        description=article_data.description,
        content=article_data.content,
        category=article_data.category,
        tags=article_data.tags,
        author=current_user.get("name", current_user.get("email", "Unknown")),
        is_published=article_data.is_published
    )
    
    article_dict = article.model_dump()
    article_dict["is_custom"] = True
    article_dict["created_by"] = current_user.get("email", "unknown")
    article_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.articles.insert_one(article_dict)
    
    return {"id": article.id, "message": "Custom article created successfully"}


@router.put("/custom/articles/{article_id}")
async def update_custom_article(
    article_id: str,
    article_data: CustomArticleCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a custom article (admin/manager only)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can edit custom content")
    
    existing = await db.articles.find_one({"id": article_id, "is_custom": True})
    if not existing:
        raise HTTPException(status_code=404, detail="Custom article not found")
    
    update_data = article_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")
    
    await db.articles.update_one({"id": article_id}, {"$set": update_data})
    return {"message": "Article updated successfully"}


@router.delete("/custom/articles/{article_id}")
async def delete_custom_article(
    article_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a custom article (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete custom content")
    
    result = await db.articles.delete_one({"id": article_id, "is_custom": True})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom article not found")
    
    return {"message": "Article deleted successfully"}


@router.post("/custom/documents")
async def create_custom_document(
    doc_data: CustomDocumentCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Create a custom document (SOP, strategy, template, etc.)"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can create custom content")
    
    doc = CustomDocument(
        title=doc_data.title,
        description=doc_data.description,
        doc_type=doc_data.doc_type,
        content=doc_data.content,
        tags=doc_data.tags,
        author_id=current_user.get("id", ""),
        author_name=current_user.get("name", current_user.get("email", "Unknown")),
        is_published=doc_data.is_published
    )
    
    doc_dict = doc.model_dump()
    doc_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.custom_documents.insert_one(doc_dict)
    
    return {"id": doc.id, "message": "Document created successfully"}


@router.get("/custom/documents")
async def get_custom_documents(
    doc_type: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all custom documents"""
    query = {}
    if doc_type:
        query["doc_type"] = doc_type
    
    # Non-admin users only see published documents
    if current_user.get("role") not in ["admin", "manager"]:
        query["is_published"] = True
    
    docs = await db.custom_documents.find(query, {"_id": 0}).to_list(100)
    return docs


@router.get("/custom/documents/{doc_id}")
async def get_custom_document(
    doc_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get a specific custom document"""
    doc = await db.custom_documents.find_one({"id": doc_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Non-admin users can only see published documents
    if current_user.get("role") not in ["admin", "manager"] and not doc.get("is_published"):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return doc


@router.put("/custom/documents/{doc_id}")
async def update_custom_document(
    doc_id: str,
    doc_data: CustomDocumentCreate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update a custom document"""
    if current_user.get("role") not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Only admins and managers can edit custom content")
    
    existing = await db.custom_documents.find_one({"id": doc_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = doc_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = current_user.get("email", "unknown")
    
    await db.custom_documents.update_one({"id": doc_id}, {"$set": update_data})
    return {"message": "Document updated successfully"}


@router.delete("/custom/documents/{doc_id}")
async def delete_custom_document(
    doc_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a custom document (admin only)"""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete documents")
    
    result = await db.custom_documents.delete_one({"id": doc_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return {"message": "Document deleted successfully"}


@router.get("/custom/all")
async def get_all_custom_content(current_user: dict = Depends(get_current_active_user)):
    """Get all custom content for the firm"""
    is_admin = current_user.get("role") in ["admin", "manager"]
    
    # Build query based on role
    published_query = {} if is_admin else {"is_published": True}
    custom_query = {"is_custom": True, **published_query}
    
    courses = await db.courses.find(custom_query, {"_id": 0}).to_list(100)
    articles = await db.articles.find(custom_query, {"_id": 0}).to_list(100)
    documents = await db.custom_documents.find(published_query, {"_id": 0}).to_list(100)
    
    return {
        "courses": courses,
        "articles": articles,
        "documents": documents,
        "totals": {
            "courses": len(courses),
            "articles": len(articles),
            "documents": len(documents)
        }
    }
