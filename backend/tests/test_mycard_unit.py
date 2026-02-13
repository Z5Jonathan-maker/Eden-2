import sys
import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("JWT_SECRET_KEY", "test-secret")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

from routes.mycard import _sort_google_reviews


def test_sort_google_reviews_recent_desc():
    reviews = [
        {"reviewer_name": "A", "time": 100, "rating": 3},
        {"reviewer_name": "B", "time": 300, "rating": 5},
        {"reviewer_name": "C", "time": 200, "rating": 1},
    ]
    sorted_reviews = _sort_google_reviews(reviews, "recent")
    assert [r["reviewer_name"] for r in sorted_reviews] == ["B", "C", "A"]


def test_sort_google_reviews_highest_rating_then_recent():
    reviews = [
        {"reviewer_name": "A", "time": 100, "rating": 5},
        {"reviewer_name": "B", "time": 300, "rating": 5},
        {"reviewer_name": "C", "time": 200, "rating": 3},
    ]
    sorted_reviews = _sort_google_reviews(reviews, "highest")
    assert [r["reviewer_name"] for r in sorted_reviews] == ["B", "A", "C"]


def test_sort_google_reviews_lowest_rating_then_oldest():
    reviews = [
        {"reviewer_name": "A", "time": 100, "rating": 1},
        {"reviewer_name": "B", "time": 300, "rating": 1},
        {"reviewer_name": "C", "time": 200, "rating": 3},
    ]
    sorted_reviews = _sort_google_reviews(reviews, "lowest")
    assert [r["reviewer_name"] for r in sorted_reviews] == ["A", "B", "C"]
