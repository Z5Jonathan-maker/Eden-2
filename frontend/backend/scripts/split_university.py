#!/usr/bin/env python3
"""
Split university.py into logical modules

Original: 1769 lines (models + HUGE seed data + routes)
After:
- university_models.py (~60 lines) - Pydantic models
- university_seed_data.py (~1150 lines) - Seed content
- university.py (~550 lines) - Routes only

Cimadevilla Operating Stack - Layer 2:
- Separate concerns for maintainability
- Seed data can be generated/updated independently
- Models reusable across app
"""

import os

print("Splitting university.py (1769 lines)...")
print("=" * 60)

# Read source
with open("../routes/university.py", 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find section boundaries
models_start = 0
models_end = 0
seed_start = 0
seed_end = 0
routes_start = 0

for i, line in enumerate(lines):
    if "class QuizQuestion(BaseModel):" in line:
        models_start = i
    if "class LessonComplete(BaseModel):" in line:
        models_end = i + 10  # Include the class definition
    if "async def seed_university_data():" in line:
        seed_start = i
    if "@router.get(\"/courses\")" in line:
        seed_end = i - 2
        routes_start = i

print(f"Models: lines {models_start+1} to {models_end+1}")
print(f"Seed data: lines {seed_start+1} to {seed_end+1}")
print(f"Routes: lines {routes_start+1} to end")

# Extract models
models_content = """'''
University Models - Pydantic Schemas

Models for courses, lessons, articles, quizzes, and progress tracking.
'''

from pydantic import BaseModel
from typing import List, Optional

""" + ''.join(lines[models_start:models_end])

# Extract seed data
seed_imports = """'''
University Seed Data

Comprehensive course and article content for the University module.
This data can be regenerated, updated, or loaded from external sources.
'''

from datetime import datetime, timezone

"""

seed_content = seed_imports + ''.join(lines[seed_start:seed_end])

# Extract routes (keeping original imports at top)
routes_content = """'''
University API Routes

Educational content management for insurance professionals.
Courses, lessons, articles, quizzes, progress tracking, and certificates.
'''

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timezone

from dependencies import db, get_current_active_user
from .university_models import (
    QuizQuestion, Lesson, Course, Article,
    UserProgress, Certificate, QuizSubmission, LessonComplete
)
from .university_seed_data import seed_university_data

router = APIRouter(prefix="/api/university", tags=["University"])

""" + ''.join(lines[routes_start:])

# Create output directory
os.makedirs("../routes/university", exist_ok=True)

# Write files
with open("../routes/university/models.py", 'w', encoding='utf-8') as f:
    f.write(models_content)
print("Created routes/university/models.py")

with open("../routes/university/seed_data.py", 'w', encoding='utf-8') as f:
    f.write(seed_content)
print("Created routes/university/seed_data.py")

with open("../routes/university/routes.py", 'w', encoding='utf-8') as f:
    f.write(routes_content)
print("Created routes/university/routes.py")

# Create __init__.py
init_content = """'''
University Module

Educational platform for insurance professionals.
'''

from .routes import router

__all__ = ["router"]
"""

with open("../routes/university/__init__.py", 'w', encoding='utf-8') as f:
    f.write(init_content)
print("Created routes/university/__init__.py")

# Count lines
models_lines = len(models_content.split('\n'))
seed_lines = len(seed_content.split('\n'))
routes_lines = len(routes_content.split('\n'))

print("\n" + "=" * 60)
print("Extraction Complete!")
print("=" * 60)
print(f"\nOriginal: 1769 lines")
print(f"\nNew structure:")
print(f"  models.py: {models_lines} lines")
print(f"  seed_data.py: {seed_lines} lines")
print(f"  routes.py: {routes_lines} lines")
print(f"  __init__.py: ~10 lines")
print(f"\nTotal: {models_lines + seed_lines + routes_lines + 10} lines")
print(f"Overhead: ~{(models_lines + seed_lines + routes_lines + 10) - 1769} lines (imports)")

print("\nNext Steps:")
print("1. Update server.py:")
print("   from routes.university import router as university_router")
print("2. Test all university endpoints")
print("3. Consider moving seed_data to data/ directory")
print("4. Deprecate routes/university.py (old file)")
