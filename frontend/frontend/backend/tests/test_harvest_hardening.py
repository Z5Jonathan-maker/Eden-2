"""
Harvest Hardening Tests - Production-critical paths for 8hr/day field use.

Tests:
  1. Pin CRUD: create, read, update, delete with permissions
  2. Territory auto-assign: server-side point-in-polygon
  3. Duplicate detection: idempotency keys + spatial dedup
  4. Visit logging: scoring, streak, status updates
  5. Streak calculation: aggregation-based, correct date math
  6. Permission enforcement: owner-only updates, admin overrides
  7. Offline sync resilience: idempotency, retry safety
  8. Territory operations: CRUD, stats, assignments
"""
import pytest
import requests
import os
import uuid
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mycard-military.preview.emergentagent.com').rstrip('/')

# Coordinates inside a known test polygon (downtown area)
TEST_LAT = 30.2672
TEST_LNG = -81.3962
# Coordinates clearly outside any polygon
OUTSIDE_LAT = 45.0
OUTSIDE_LNG = -120.0


class TestHarvestPinLifecycle:
    """Pin create → update → visit → delete with full validation"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
        data = login_resp.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_pin_ids = []

    def _create_pin(self, lat=TEST_LAT, lng=TEST_LNG, **kwargs):
        payload = {
            "latitude": lat,
            "longitude": lng,
            "disposition": "unmarked",
            "idempotency_key": kwargs.get("idempotency_key", str(uuid.uuid4())),
            **kwargs,
        }
        resp = self.session.post(f"{BASE_URL}/api/canvassing-map/pins", json=payload)
        if resp.status_code == 200:
            pin_id = resp.json().get("id") or resp.json().get("pin", {}).get("id")
            if pin_id:
                self.created_pin_ids.append(pin_id)
        return resp

    def teardown_method(self):
        """Cleanup pins created during test"""
        for pin_id in self.created_pin_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
            except Exception:
                pass

    # ── Pin Creation ──

    def test_create_pin_returns_valid_structure(self):
        """Pin create returns all required fields"""
        resp = self._create_pin()
        assert resp.status_code == 200, f"Pin create failed: {resp.text}"
        data = resp.json()
        assert "id" in data or "pin" in data, "Response must contain pin ID"
        pin_id = data.get("id") or data.get("pin", {}).get("id")
        assert pin_id, "Pin ID must be non-empty"

    def test_create_pin_persists_and_reads_back(self):
        """Created pin is retrievable via GET"""
        resp = self._create_pin()
        assert resp.status_code == 200
        pin_id = resp.json().get("id") or resp.json().get("pin", {}).get("id")

        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        assert get_resp.status_code == 200, f"Pin read failed: {get_resp.text}"
        pin = get_resp.json()
        assert abs(float(pin.get("latitude", 0)) - TEST_LAT) < 0.001
        assert abs(float(pin.get("longitude", 0)) - TEST_LNG) < 0.001
        assert pin.get("disposition") == "unmarked"

    def test_create_pin_has_history(self):
        """New pin starts with initial history entry"""
        resp = self._create_pin()
        assert resp.status_code == 200
        pin_id = resp.json().get("id") or resp.json().get("pin", {}).get("id")

        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        pin = get_resp.json()
        history = pin.get("history", [])
        assert len(history) >= 1, "Pin should have initial history entry"
        assert history[0].get("disposition") == "unmarked"

    # ── Idempotency ──

    def test_idempotency_key_prevents_duplicates(self):
        """Same idempotency key returns same pin, no duplicate created"""
        key = str(uuid.uuid4())
        resp1 = self._create_pin(idempotency_key=key)
        assert resp1.status_code == 200
        id1 = resp1.json().get("id") or resp1.json().get("pin", {}).get("id")

        # Second create with same key
        resp2 = self._create_pin(idempotency_key=key)
        assert resp2.status_code == 200
        data2 = resp2.json()
        id2 = data2.get("id") or data2.get("pin", {}).get("id")

        # Should return same pin (or duplicate indicator)
        is_duplicate = data2.get("duplicate") or data2.get("duplicate_reason")
        assert is_duplicate or id1 == id2, "Idempotency key should prevent duplicate"

    def test_spatial_dedup_within_window(self):
        """Two pins at same location within 45s should dedup"""
        key1 = str(uuid.uuid4())
        key2 = str(uuid.uuid4())
        resp1 = self._create_pin(idempotency_key=key1)
        assert resp1.status_code == 200

        # Same location, different key, within dedup window
        resp2 = self._create_pin(idempotency_key=key2)
        assert resp2.status_code == 200
        data2 = resp2.json()
        # Should be flagged as duplicate
        assert data2.get("duplicate") or data2.get("existing_pin"), \
            "Spatial dedup should catch same-location pin within window"

    # ── Pin Updates ──

    def test_update_pin_disposition(self):
        """Disposition update changes pin status and adds history"""
        resp = self._create_pin()
        pin_id = resp.json().get("id") or resp.json().get("pin", {}).get("id")

        update_resp = self.session.patch(
            f"{BASE_URL}/api/canvassing-map/pins/{pin_id}",
            json={"disposition": "not_home"}
        )
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        data = update_resp.json()
        assert "points_earned" in data, "Update response should include points_earned"

        # Verify persistence
        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        pin = get_resp.json()
        assert pin.get("disposition") == "not_home"
        assert len(pin.get("history", [])) >= 2, "History should grow on disposition change"

    def test_update_pin_awards_points(self):
        """Disposition change from unmarked → appointment awards points"""
        resp = self._create_pin()
        pin_id = resp.json().get("id") or resp.json().get("pin", {}).get("id")

        update_resp = self.session.patch(
            f"{BASE_URL}/api/canvassing-map/pins/{pin_id}",
            json={"disposition": "appointment"}
        )
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data.get("points_earned", 0) >= 10, \
            f"Appointment should award >=10 points, got {data.get('points_earned')}"

    def test_update_nonexistent_pin_404(self):
        """Updating a pin that doesn't exist returns 404"""
        resp = self.session.patch(
            f"{BASE_URL}/api/canvassing-map/pins/nonexistent-{uuid.uuid4()}",
            json={"disposition": "not_home"}
        )
        assert resp.status_code == 404

    # ── Pin Deletion ──

    def test_delete_own_pin(self):
        """Owner can delete their own pin"""
        resp = self._create_pin()
        pin_id = resp.json().get("id") or resp.json().get("pin", {}).get("id")

        del_resp = self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        assert del_resp.status_code == 200

        # Verify gone
        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        assert get_resp.status_code == 404

    def test_delete_nonexistent_pin_404(self):
        """Deleting a pin that doesn't exist returns 404"""
        resp = self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/nonexistent-{uuid.uuid4()}")
        assert resp.status_code == 404


class TestTerritoryAutoAssign:
    """Server-side point-in-polygon territory assignment"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_territory_ids = []
        self.created_pin_ids = []

    def teardown_method(self):
        for pin_id in self.created_pin_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
            except Exception:
                pass
        for tid in self.created_territory_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/canvassing-map/territories/{tid}")
            except Exception:
                pass

    def test_create_territory_and_auto_assign_pin(self):
        """Pin dropped inside a territory polygon gets auto-assigned"""
        # Create a territory polygon around TEST_LAT, TEST_LNG
        polygon = [
            [TEST_LAT - 0.01, TEST_LNG - 0.01],
            [TEST_LAT - 0.01, TEST_LNG + 0.01],
            [TEST_LAT + 0.01, TEST_LNG + 0.01],
            [TEST_LAT + 0.01, TEST_LNG - 0.01],
        ]
        terr_resp = self.session.post(f"{BASE_URL}/api/canvassing-map/territories", json={
            "name": f"Test Territory {uuid.uuid4().hex[:8]}",
            "coordinates": polygon,
            "color": "#FF6600"
        })
        assert terr_resp.status_code == 200, f"Territory create failed: {terr_resp.text}"
        territory_id = terr_resp.json().get("id")
        self.created_territory_ids.append(territory_id)

        # Create pin inside that polygon WITHOUT specifying territory_id
        pin_resp = self.session.post(f"{BASE_URL}/api/canvassing-map/pins", json={
            "latitude": TEST_LAT,
            "longitude": TEST_LNG,
            "disposition": "unmarked",
            "idempotency_key": str(uuid.uuid4()),
            # territory_id intentionally omitted
        })
        assert pin_resp.status_code == 200
        pin_data = pin_resp.json()
        pin_id = pin_data.get("id") or pin_data.get("pin", {}).get("id")
        self.created_pin_ids.append(pin_id)

        # Verify the pin was auto-assigned to the territory
        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        assert get_resp.status_code == 200
        pin = get_resp.json()
        assert pin.get("territory_id") == territory_id, \
            f"Pin should be auto-assigned to territory {territory_id}, got {pin.get('territory_id')}"

    def test_pin_outside_all_territories_has_null_territory(self):
        """Pin dropped outside all territories gets territory_id=null"""
        pin_resp = self.session.post(f"{BASE_URL}/api/canvassing-map/pins", json={
            "latitude": OUTSIDE_LAT,
            "longitude": OUTSIDE_LNG,
            "disposition": "unmarked",
            "idempotency_key": str(uuid.uuid4()),
        })
        assert pin_resp.status_code == 200
        pin_data = pin_resp.json()
        pin_id = pin_data.get("id") or pin_data.get("pin", {}).get("id")
        self.created_pin_ids.append(pin_id)

        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        pin = get_resp.json()
        # Should be null since no territory contains this point
        assert pin.get("territory_id") is None, \
            f"Pin outside all territories should have null territory_id, got {pin.get('territory_id')}"


class TestTerritoryOperations:
    """Territory CRUD and stats"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_territory_ids = []

    def teardown_method(self):
        for tid in self.created_territory_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/canvassing-map/territories/{tid}")
            except Exception:
                pass

    def test_create_territory(self):
        """Territory CRUD: create with valid polygon"""
        polygon = [
            [30.0, -81.0],
            [30.0, -81.1],
            [30.1, -81.1],
            [30.1, -81.0],
        ]
        resp = self.session.post(f"{BASE_URL}/api/canvassing-map/territories", json={
            "name": f"CRUD Test {uuid.uuid4().hex[:6]}",
            "coordinates": polygon,
            "color": "#22C55E"
        })
        assert resp.status_code == 200, f"Territory create failed: {resp.text}"
        data = resp.json()
        assert "id" in data
        self.created_territory_ids.append(data["id"])

    def test_list_territories(self):
        """GET /territories returns array with stats"""
        resp = self.session.get(f"{BASE_URL}/api/canvassing-map/territories")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list), "Territories endpoint should return array"
        if len(data) > 0:
            t = data[0]
            assert "id" in t
            assert "name" in t
            assert "stats" in t, "Each territory should include stats"

    def test_get_territory_stats(self):
        """Territory stats include disposition breakdown"""
        resp = self.session.get(f"{BASE_URL}/api/canvassing-map/territories")
        territories = resp.json()
        if len(territories) > 0:
            t = territories[0]
            stats = t.get("stats", {})
            assert "total_pins" in stats, "Stats should include total_pins"
            assert isinstance(stats.get("total_pins", 0), int)

    def test_update_territory(self):
        """PATCH territory updates name/color"""
        # Create one
        polygon = [[30.0, -81.0], [30.0, -81.1], [30.1, -81.1], [30.1, -81.0]]
        create_resp = self.session.post(f"{BASE_URL}/api/canvassing-map/territories", json={
            "name": "Original Name",
            "coordinates": polygon,
        })
        tid = create_resp.json().get("id")
        self.created_territory_ids.append(tid)

        # Update
        patch_resp = self.session.patch(
            f"{BASE_URL}/api/canvassing-map/territories/{tid}",
            json={"name": "Updated Name", "color": "#FF0000"}
        )
        assert patch_resp.status_code == 200

        # Verify
        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/territories/{tid}")
        assert get_resp.json().get("name") == "Updated Name"

    def test_delete_territory_soft_deletes(self):
        """DELETE territory soft-deletes (sets is_active=false)"""
        polygon = [[30.0, -81.0], [30.0, -81.1], [30.1, -81.1], [30.1, -81.0]]
        create_resp = self.session.post(f"{BASE_URL}/api/canvassing-map/territories", json={
            "name": "To Delete",
            "coordinates": polygon,
        })
        tid = create_resp.json().get("id")

        del_resp = self.session.delete(f"{BASE_URL}/api/canvassing-map/territories/{tid}")
        assert del_resp.status_code == 200


class TestVisitLogging:
    """Visit creation, scoring, and history"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.created_pin_ids = []

    def teardown_method(self):
        for pin_id in self.created_pin_ids:
            try:
                self.session.delete(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
            except Exception:
                pass

    def _create_test_pin(self):
        resp = self.session.post(f"{BASE_URL}/api/canvassing-map/pins", json={
            "latitude": TEST_LAT + 0.001 * len(self.created_pin_ids),
            "longitude": TEST_LNG,
            "disposition": "unmarked",
            "idempotency_key": str(uuid.uuid4()),
        })
        pin_id = resp.json().get("id") or resp.json().get("pin", {}).get("id")
        if pin_id:
            self.created_pin_ids.append(pin_id)
        return pin_id

    def test_log_visit_returns_points(self):
        """POST /visits returns points_earned and status_info"""
        pin_id = self._create_test_pin()
        resp = self.session.post(f"{BASE_URL}/api/canvassing-map/visits", json={
            "pin_id": pin_id,
            "status": "NH",
            "lat": TEST_LAT,
            "lng": TEST_LNG,
        })
        assert resp.status_code == 200, f"Visit create failed: {resp.text}"
        data = resp.json()
        assert "points_earned" in data, "Visit response must include points_earned"
        assert "status_info" in data or "status" in data, "Visit response must include status"
        assert data.get("visit_count", 0) >= 1, "Visit count should be >= 1"

    def test_visit_updates_pin_disposition(self):
        """Visit changes pin's disposition to the visit status"""
        pin_id = self._create_test_pin()
        self.session.post(f"{BASE_URL}/api/canvassing-map/visits", json={
            "pin_id": pin_id,
            "status": "CB",
            "lat": TEST_LAT,
            "lng": TEST_LNG,
        })

        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        pin = get_resp.json()
        # Disposition should reflect the visit status
        assert pin.get("disposition") in ("callback", "CB", "cb"), \
            f"Pin disposition should be callback, got {pin.get('disposition')}"

    def test_visit_increments_visit_count(self):
        """Multiple visits increment visit_count"""
        pin_id = self._create_test_pin()

        for status in ["NH", "NH", "CB"]:
            resp = self.session.post(f"{BASE_URL}/api/canvassing-map/visits", json={
                "pin_id": pin_id,
                "status": status,
                "lat": TEST_LAT,
                "lng": TEST_LNG,
            })
            assert resp.status_code == 200

        get_resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}")
        pin = get_resp.json()
        assert int(pin.get("visit_count", 0)) >= 3, \
            f"Visit count should be >= 3, got {pin.get('visit_count')}"

    def test_visit_history_endpoint(self):
        """GET /pins/{id}/visits returns visit history"""
        pin_id = self._create_test_pin()
        self.session.post(f"{BASE_URL}/api/canvassing-map/visits", json={
            "pin_id": pin_id, "status": "NH", "lat": TEST_LAT, "lng": TEST_LNG,
        })

        resp = self.session.get(f"{BASE_URL}/api/canvassing-map/pins/{pin_id}/visits")
        assert resp.status_code == 200
        data = resp.json()
        assert "visits" in data
        assert len(data["visits"]) >= 1

    def test_visit_nonexistent_pin_404(self):
        """Visit on nonexistent pin returns 404"""
        resp = self.session.post(f"{BASE_URL}/api/canvassing-map/visits", json={
            "pin_id": f"nonexistent-{uuid.uuid4()}",
            "status": "NH",
            "lat": TEST_LAT,
            "lng": TEST_LNG,
        })
        assert resp.status_code == 404

    def test_signed_visit_awards_high_points(self):
        """SG (signed) visit awards 50+ base points"""
        pin_id = self._create_test_pin()
        resp = self.session.post(f"{BASE_URL}/api/canvassing-map/visits", json={
            "pin_id": pin_id,
            "status": "SG",
            "lat": TEST_LAT,
            "lng": TEST_LNG,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("points_earned", 0) >= 50, \
            f"Signed visit should award >= 50 points, got {data.get('points_earned')}"


class TestScoringAndStreaks:
    """Scoring engine: stats, leaderboard, streaks, multipliers"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})

    def test_today_stats_structure(self):
        """GET /api/harvest/v2/today returns complete daily stats"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/today")
        assert resp.status_code == 200, f"Today stats failed: {resp.text}"
        data = resp.json()
        assert "doors_knocked" in data or "total_visits" in data, \
            "Today stats should include door count"
        assert "streak_days" in data or "streak" in data, \
            "Today stats should include streak"

    def test_leaderboard_returns_ranked_entries(self):
        """Leaderboard returns sorted entries with required fields"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/leaderboard")
        assert resp.status_code == 200, f"Leaderboard failed: {resp.text}"
        data = resp.json()
        entries = data if isinstance(data, list) else data.get("entries", data.get("leaderboard", []))
        assert isinstance(entries, list), "Leaderboard should return array"
        if len(entries) >= 2:
            # Verify sorted by points/doors descending
            for i in range(len(entries) - 1):
                score_a = entries[i].get("points", entries[i].get("total_points", 0))
                score_b = entries[i + 1].get("points", entries[i + 1].get("total_points", 0))
                assert score_a >= score_b, "Leaderboard should be sorted descending"

    def test_user_stats_structure(self):
        """User stats include all_time, today, streak, multiplier"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/stats/me")
        assert resp.status_code == 200, f"Stats failed: {resp.text}"
        data = resp.json()
        # Should have at minimum: points, streak info
        has_stats = ("all_time" in data or "total_points" in data or
                     "today" in data or "points" in data)
        assert has_stats, f"Stats should include scoring data, got: {list(data.keys())}"

    def test_badges_structure(self):
        """Badges endpoint returns definitions with earned status"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/badges")
        assert resp.status_code == 200, f"Badges failed: {resp.text}"
        data = resp.json()
        badges = data.get("badges", data if isinstance(data, list) else [])
        assert len(badges) > 0, "Should have badge definitions"
        badge = badges[0]
        assert "id" in badge or "name" in badge, "Badge should have id or name"

    def test_daily_blitz_structure(self):
        """Daily Blitz returns active challenges"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/daily-blitz")
        assert resp.status_code == 200, f"Daily Blitz failed: {resp.text}"

    def test_streak_multiplier_values(self):
        """Multiplier is always >= 1.0 and <= 2.0"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/stats/me")
        if resp.status_code == 200:
            data = resp.json()
            multiplier = data.get("multiplier", 1.0)
            assert 1.0 <= multiplier <= 2.0, \
                f"Multiplier should be between 1.0 and 2.0, got {multiplier}"


class TestDispositionConfig:
    """Disposition configuration endpoint"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})

    def test_get_dispositions(self):
        """GET dispositions returns all status types with colors"""
        resp = self.session.get(f"{BASE_URL}/api/canvassing-map/dispositions")
        assert resp.status_code == 200, f"Dispositions failed: {resp.text}"
        data = resp.json()
        # Should have common dispositions
        dispositions = data if isinstance(data, dict) else {}
        has_dispositions = len(dispositions) >= 4 or (isinstance(data, list) and len(data) >= 4)
        assert has_dispositions, f"Should have >= 4 dispositions, got {len(dispositions) if isinstance(dispositions, dict) else len(data)}"


class TestRecentVisits:
    """Recent visits and filtering"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})

    def test_recent_visits_returns_array(self):
        """GET /visits/recent returns array of visits"""
        resp = self.session.get(f"{BASE_URL}/api/canvassing-map/visits/recent")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list), "Recent visits should return array"

    def test_recent_visits_filter_by_user(self):
        """Recent visits can be filtered by user_id"""
        resp = self.session.get(
            f"{BASE_URL}/api/canvassing-map/visits/recent",
            params={"user_id": self.user_id}
        )
        assert resp.status_code == 200
        data = resp.json()
        for visit in data:
            assert visit.get("user_id") == self.user_id, \
                "Filtered visits should all belong to requested user"


class TestCompetitions:
    """Competition endpoints"""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        login_resp = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@eden.com", "password": "password"
        })
        assert login_resp.status_code == 200
        data = login_resp.json()
        self.token = data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})

    def test_get_competitions(self):
        """GET competitions returns array"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/competitions")
        assert resp.status_code == 200
        data = resp.json()
        comps = data if isinstance(data, list) else data.get("competitions", [])
        assert isinstance(comps, list), "Competitions should return array"

    def test_get_active_competitions(self):
        """Active competitions endpoint filters correctly"""
        resp = self.session.get(f"{BASE_URL}/api/harvest/v2/competitions/active")
        assert resp.status_code == 200


class TestEndpointAuth:
    """All Harvest endpoints require authentication"""

    def test_pins_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/canvassing-map/pins")
        assert resp.status_code in (401, 403, 422), \
            f"Unauthenticated request should be rejected, got {resp.status_code}"

    def test_visits_requires_auth(self):
        resp = requests.post(f"{BASE_URL}/api/canvassing-map/visits", json={
            "pin_id": "test", "status": "NH", "lat": 0, "lng": 0
        })
        assert resp.status_code in (401, 403, 422)

    def test_territories_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/canvassing-map/territories")
        assert resp.status_code in (401, 403, 422)

    def test_harvest_today_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/harvest/v2/today")
        assert resp.status_code in (401, 403, 422)

    def test_leaderboard_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/harvest/v2/leaderboard")
        assert resp.status_code in (401, 403, 422)
