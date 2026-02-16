'''
University Models - Pydantic Schemas

Models for courses, lessons, articles, quizzes, and progress tracking.
'''

from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid

class QuizQuestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    options: List[str]
    correct_answer: int

class Lesson(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    content: str
    video_url: Optional[str] = None
    duration_minutes: int = 10
    order: int = 0
    teaching_beats: List[str] = []
    carrier_move: Optional[str] = None
    our_move: Optional[str] = None
    completion_criteria: Optional[str] = None

class Course(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    category: str
    track: Optional[str] = None  # "foundation", "operator", "advanced-elite"
    difficulty: Optional[int] = None  # 1-5
    est_minutes: Optional[int] = None
    tags: List[str] = []
    thumbnail: Optional[str] = None
    why_this_matters: Optional[str] = None
    outcomes: List[str] = []
    lessons: List[Lesson] = []
    quiz: List[QuizQuestion] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_published: bool = True

class Article(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    content: str
    category: str
    tags: List[str] = []
    author: str = "Care Claims University"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_published: bool = True

class UserProgress(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    course_id: str
    completed_lessons: List[str] = []
    quiz_score: Optional[int] = None
    quiz_passed: bool = False
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class Certificate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    course_id: str
    course_title: str
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuizSubmission(BaseModel):
    course_id: str
    answers: List[int]

class LessonComplete(BaseModel):
    course_id: str
    lesson_id: str
