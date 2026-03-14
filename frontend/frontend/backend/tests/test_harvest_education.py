"""
Test suite for Harvest Gamification and Client Education Hub APIs
Tests: Leaderboard, Badges, Competitions, Team Stats, Education Articles, Glossary
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@eden.com"
TEST_PASSWORD = "password"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


# ============================================
# Harvest Gamification API Tests
# ============================================

class TestHarvestLeaderboard:
    """Tests for /api/harvest/leaderboard endpoint"""
    
    def test_get_leaderboard_success(self, auth_headers):
        """Test GET /api/harvest/leaderboard returns valid response"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/leaderboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "period" in data
        assert "metric" in data
        assert "leaderboard" in data
        assert "updated_at" in data
        assert isinstance(data["leaderboard"], list)
    
    def test_leaderboard_entry_structure(self, auth_headers):
        """Test leaderboard entries have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/leaderboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data["leaderboard"]) > 0:
            entry = data["leaderboard"][0]
            # Verify required fields
            assert "rank" in entry
            assert "user_id" in entry
            assert "name" in entry
            assert "initials" in entry
            assert "doors" in entry
            assert "signed" in entry
            assert "appointments" in entry
            assert "streak" in entry
            assert "conversion_rate" in entry
    
    def test_leaderboard_period_filter(self, auth_headers):
        """Test leaderboard with different period filters"""
        for period in ["day", "week", "month", "all"]:
            response = requests.get(
                f"{BASE_URL}/api/harvest/leaderboard?period={period}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["period"] == period
    
    def test_leaderboard_metric_filter(self, auth_headers):
        """Test leaderboard with different metric filters"""
        for metric in ["doors", "appointments", "signed"]:
            response = requests.get(
                f"{BASE_URL}/api/harvest/leaderboard?metric={metric}",
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["metric"] == metric
    
    def test_leaderboard_requires_auth(self):
        """Test leaderboard requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/leaderboard")
        assert response.status_code in [401, 403]  # 403 Forbidden also acceptable


class TestHarvestBadges:
    """Tests for /api/harvest/badges endpoint"""
    
    def test_get_badges_success(self, auth_headers):
        """Test GET /api/harvest/badges returns valid response"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/badges",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "badges" in data
        assert "earned_count" in data
        assert "total_count" in data
        assert isinstance(data["badges"], list)
        assert data["total_count"] >= 10  # Default badges
    
    def test_badge_structure(self, auth_headers):
        """Test badge entries have correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/badges",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["badges"]) > 0
        
        badge = data["badges"][0]
        assert "id" in badge
        assert "icon" in badge
        assert "name" in badge
        assert "description" in badge
        assert "criteria_type" in badge
        assert "criteria_value" in badge
        assert "category" in badge
        assert "earned" in badge
        assert isinstance(badge["earned"], bool)
    
    def test_badges_requires_auth(self):
        """Test badges requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/badges")
        assert response.status_code in [401, 403]  # 403 Forbidden also acceptable


class TestHarvestCompetitions:
    """Tests for /api/harvest/competitions endpoint"""
    
    def test_get_competitions_success(self, auth_headers):
        """Test GET /api/harvest/competitions returns valid response"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/competitions",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "competitions" in data
        assert isinstance(data["competitions"], list)
    
    def test_competitions_requires_auth(self):
        """Test competitions requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/competitions")
        assert response.status_code in [401, 403]  # 403 Forbidden also acceptable


class TestHarvestTeamStats:
    """Tests for /api/harvest/stats/team endpoint"""
    
    def test_get_team_stats_success(self, auth_headers):
        """Test GET /api/harvest/stats/team returns valid response"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/stats/team",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "doors_today" in data
        assert "active_users" in data
        assert "users_worked_today" in data
        assert "total_team_members" in data
        
        # Verify types
        assert isinstance(data["doors_today"], int)
        assert isinstance(data["active_users"], int)
        assert isinstance(data["total_team_members"], int)
    
    def test_team_stats_requires_auth(self):
        """Test team stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/harvest/stats/team")
        assert response.status_code in [401, 403]  # 403 Forbidden also acceptable


# ============================================
# Client Education Hub API Tests
# ============================================

class TestClientEducationCategories:
    """Tests for /api/client-education/categories endpoint"""
    
    def test_get_categories_success(self):
        """Test GET /api/client-education/categories returns 6 categories"""
        response = requests.get(f"{BASE_URL}/api/client-education/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert "categories" in data
        assert len(data["categories"]) == 6
    
    def test_categories_structure(self):
        """Test category entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/client-education/categories")
        assert response.status_code == 200
        
        data = response.json()
        expected_ids = ["timeline", "policy", "documents", "faq", "communication", "glossary"]
        
        for cat in data["categories"]:
            assert "id" in cat
            assert "name" in cat
            assert "icon" in cat
            assert "description" in cat
            assert "count" in cat
            assert cat["id"] in expected_ids


class TestClientEducationArticles:
    """Tests for /api/client-education/articles endpoint"""
    
    def test_get_articles_success(self):
        """Test GET /api/client-education/articles returns articles"""
        response = requests.get(f"{BASE_URL}/api/client-education/articles")
        assert response.status_code == 200
        
        data = response.json()
        assert "articles" in data
        assert len(data["articles"]) >= 5  # Default seeded articles
    
    def test_article_structure(self):
        """Test article entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/client-education/articles")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["articles"]) > 0
        
        article = data["articles"][0]
        assert "id" in article
        assert "category" in article
        assert "title" in article
        assert "content" in article
        assert "order" in article
        assert "is_published" in article
    
    def test_articles_filter_by_category(self):
        """Test filtering articles by category"""
        response = requests.get(f"{BASE_URL}/api/client-education/articles?category=timeline")
        assert response.status_code == 200
        
        data = response.json()
        for article in data["articles"]:
            assert article["category"] == "timeline"


class TestClientEducationGlossary:
    """Tests for /api/client-education/glossary endpoint"""
    
    def test_get_glossary_success(self):
        """Test GET /api/client-education/glossary returns terms"""
        response = requests.get(f"{BASE_URL}/api/client-education/glossary")
        assert response.status_code == 200
        
        data = response.json()
        assert "terms" in data
        assert len(data["terms"]) >= 10  # Default seeded terms
    
    def test_glossary_term_structure(self):
        """Test glossary term entries have correct structure"""
        response = requests.get(f"{BASE_URL}/api/client-education/glossary")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["terms"]) > 0
        
        term = data["terms"][0]
        assert "id" in term
        assert "term" in term
        assert "definition" in term
        assert "category" in term
    
    def test_glossary_filter_by_category(self):
        """Test filtering glossary by category"""
        response = requests.get(f"{BASE_URL}/api/client-education/glossary?category=insurance")
        assert response.status_code == 200
        
        data = response.json()
        for term in data["terms"]:
            assert term["category"] == "insurance"


# ============================================
# Integration Tests
# ============================================

class TestHarvestMyRank:
    """Tests for /api/harvest/leaderboard/my-rank endpoint"""
    
    def test_get_my_rank_success(self, auth_headers):
        """Test GET /api/harvest/leaderboard/my-rank returns user's rank"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/leaderboard/my-rank",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "rank" in data
        assert "stats" in data
        assert "total_participants" in data


class TestHarvestUserStats:
    """Tests for /api/harvest/stats/user endpoint"""
    
    def test_get_user_stats_success(self, auth_headers):
        """Test GET /api/harvest/stats/user returns user stats"""
        response = requests.get(
            f"{BASE_URL}/api/harvest/stats/user",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "total_doors" in data
        assert "total_signed" in data
        assert "current_streak" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
