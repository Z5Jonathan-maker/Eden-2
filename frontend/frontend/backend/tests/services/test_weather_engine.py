import os
import sys


sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))

from services.weather_engine import (
    aggregate_station_evidence,
    build_hail_candidates,
    build_wind_candidates,
    score_observation_qc,
    summarize_station_quality,
)


def test_observation_qc_penalizes_invalid_timestamp_and_missing_wind():
    result = score_observation_qc(
        {
            "timestamp": "not-a-date",
            "wind_speed_mph": None,
            "wind_gust_mph": None,
            "peak_wind_gust_mph": None,
        }
    )
    assert result["score"] < 0.3
    assert "missing_or_invalid_timestamp" in result["flags"]
    assert "no_wind_values" in result["flags"]


def test_observation_qc_rewards_raw_metar_when_values_are_valid():
    result = score_observation_qc(
        {
            "timestamp": "2026-01-10 14:00",
            "wind_speed_mph": 22.1,
            "wind_gust_mph": 34.3,
            "peak_wind_gust_mph": 37.8,
            "raw_metar": "KTPA 101400Z 10022G34KT",
        }
    )
    assert result["score"] >= 0.95
    assert result["flags"] == []


def test_station_aggregation_prefers_closer_high_qc_station():
    station_close = {
        "station_id": "KTPA",
        "station_name": "Tampa Intl",
        "distance_miles": 3.2,
    }
    station_far = {
        "station_id": "KPIE",
        "station_name": "St Pete Clearwater",
        "distance_miles": 18.5,
    }

    close_obs = [
        {"timestamp": "2026-01-10 14:00", "wind_gust_mph": 56.0, "raw_metar": "A"},
        {"timestamp": "2026-01-10 15:00", "wind_gust_mph": 52.0, "raw_metar": "B"},
    ]
    far_obs = [
        {"timestamp": "2026-01-10 14:00", "wind_gust_mph": 75.0},
        {"timestamp": "bad-ts", "wind_gust_mph": None},
    ]

    summaries = [
        summarize_station_quality(station_close, close_obs),
        summarize_station_quality(station_far, far_obs),
    ]
    aggregate = aggregate_station_evidence(summaries)

    assert aggregate["supporting_station_count"] == 2
    assert aggregate["weighted_peak_wind_mph"] >= 50
    assert aggregate["weighted_peak_wind_mph"] < 75
    assert aggregate["confidence_low_mph"] <= aggregate["weighted_peak_wind_mph"] <= aggregate["confidence_high_mph"]
    assert aggregate["overall_qc_score"] > 0.4


def test_build_wind_candidates_ranks_multi_station_overlap_higher():
    station_observations = {
        "KTPA": [
            {"timestamp": "2026-01-10 14:00", "wind_gust_mph": 52.0},
            {"timestamp": "2026-01-11 14:00", "wind_gust_mph": 60.0},
        ],
        "KPIE": [
            {"timestamp": "2026-01-10 14:30", "wind_gust_mph": 48.0},
        ],
    }
    station_metadata = {
        "KTPA": {"station_name": "Tampa Intl", "distance_miles": 3.0},
        "KPIE": {"station_name": "St Pete Clearwater", "distance_miles": 14.0},
    }
    station_weight_map = {"KTPA": 0.17, "KPIE": 0.08}

    candidates = build_wind_candidates(
        station_observations=station_observations,
        station_metadata=station_metadata,
        station_weight_map=station_weight_map,
        min_wind_mph=30.0,
    )

    assert len(candidates) == 2
    assert candidates[0]["candidate_date"] == "2026-01-10"
    assert candidates[0]["station_count"] == 2
    assert candidates[0]["confidence"] in {"high", "confirmed", "medium"}


def test_build_hail_candidates_groups_and_scores_reports():
    hail_reports = [
        {
            "timestamp": "2026-01-20T13:30:00+00:00",
            "distance_miles": 6.4,
            "magnitude": 1.25,
            "lsr_type": "HAIL",
        },
        {
            "timestamp": "2026-01-20T14:05:00+00:00",
            "distance_miles": 8.0,
            "magnitude": 1.0,
            "lsr_type": "HAIL",
        },
        {
            "timestamp": "2026-01-21T14:05:00+00:00",
            "distance_miles": 24.0,
            "magnitude": 0.75,
            "lsr_type": "HAIL",
        },
    ]
    candidates = build_hail_candidates(hail_reports, max_distance_miles=25.0)

    assert len(candidates) == 2
    assert candidates[0]["candidate_date"] == "2026-01-20"
    assert candidates[0]["report_count"] == 2
    assert candidates[0]["max_hail_inches"] >= 1.0
