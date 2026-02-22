from __future__ import annotations

import math
from datetime import datetime
from typing import Any, Dict, List, Optional


MAX_PLAUSIBLE_WIND_MPH = 180.0


def _safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_timestamp(value: Any) -> Optional[datetime]:
    if not value or not isinstance(value, str):
        return None
    cleaned = value.strip().replace("Z", "+00:00")
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(cleaned.split("+")[0].strip(), fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(cleaned)
    except ValueError:
        return None


def parse_timestamp(value: Any) -> Optional[datetime]:
    return _parse_timestamp(value)


def score_observation_qc(observation: Dict[str, Any]) -> Dict[str, Any]:
    """
    Deterministic quality score for one weather observation.
    Returns score in [0, 1] with machine-readable flags for defensibility.
    """
    flags: List[str] = []
    score = 1.0

    timestamp = _parse_timestamp(observation.get("timestamp"))
    if not timestamp:
        flags.append("missing_or_invalid_timestamp")
        score -= 0.35

    wind_speed = _safe_float(observation.get("wind_speed_mph"))
    wind_gust = _safe_float(observation.get("wind_gust_mph"))
    peak_gust = _safe_float(observation.get("peak_wind_gust_mph"))

    if wind_speed is None and wind_gust is None and peak_gust is None:
        flags.append("no_wind_values")
        score -= 0.45

    for label, value in (
        ("wind_speed_mph", wind_speed),
        ("wind_gust_mph", wind_gust),
        ("peak_wind_gust_mph", peak_gust),
    ):
        if value is not None and (value < 0 or value > MAX_PLAUSIBLE_WIND_MPH):
            flags.append(f"implausible_{label}")
            score -= 0.55
            break

    if observation.get("raw_metar"):
        score += 0.05

    return {
        "score": max(0.0, min(1.0, round(score, 4))),
        "flags": flags,
    }


def summarize_station_quality(
    station: Dict[str, Any],
    observations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    qc_details = [score_observation_qc(obs) for obs in observations]
    qc_scores = [row["score"] for row in qc_details]
    avg_qc = sum(qc_scores) / len(qc_scores) if qc_scores else 0.0

    max_wind = 0.0
    for obs in observations:
        max_wind = max(
            max_wind,
            _safe_float(obs.get("wind_speed_mph")) or 0.0,
            _safe_float(obs.get("wind_gust_mph")) or 0.0,
            _safe_float(obs.get("peak_wind_gust_mph")) or 0.0,
        )

    flattened_flags: List[str] = []
    for row in qc_details:
        flattened_flags.extend(row["flags"])
    unique_flags = sorted(set(flattened_flags))

    return {
        "station_id": station.get("station_id"),
        "station_name": station.get("station_name"),
        "distance_miles": _safe_float(station.get("distance_miles")) or 0.0,
        "observation_count": len(observations),
        "max_wind_mph": round(max_wind, 2),
        "avg_qc_score": round(avg_qc, 4),
        "qc_flags": unique_flags,
    }


def aggregate_station_evidence(station_summaries: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Weighted aggregation that favors closer stations with stronger QC and higher sample counts.
    """
    usable = []
    rejected = []

    for summary in station_summaries:
        obs_count = int(summary.get("observation_count", 0) or 0)
        max_wind = _safe_float(summary.get("max_wind_mph")) or 0.0
        avg_qc = _safe_float(summary.get("avg_qc_score")) or 0.0
        distance = max(0.0, _safe_float(summary.get("distance_miles")) or 0.0)

        if obs_count <= 0 or max_wind <= 0:
            rejected.append({**summary, "reject_reason": "no_usable_wind_data"})
            continue
        if avg_qc < 0.2:
            rejected.append({**summary, "reject_reason": "low_qc"})
            continue

        weight = (1.0 / (1.0 + distance)) * (0.5 + 0.5 * avg_qc) * math.log1p(obs_count)
        usable.append({**summary, "weight": weight})

    if not usable:
        return {
            "weighted_peak_wind_mph": 0.0,
            "confidence_low_mph": 0.0,
            "confidence_high_mph": 0.0,
            "overall_qc_score": 0.0,
            "supporting_station_count": 0,
            "trace": {"usable": [], "rejected": rejected},
        }

    total_weight = sum(s["weight"] for s in usable)
    weighted_mean = sum((s["max_wind_mph"] * s["weight"]) for s in usable) / total_weight
    weighted_var = sum((s["weight"] * ((s["max_wind_mph"] - weighted_mean) ** 2)) for s in usable) / total_weight
    weighted_std = math.sqrt(max(0.0, weighted_var))

    overall_qc = sum((s["avg_qc_score"] * s["weight"]) for s in usable) / total_weight
    confidence_low = max(0.0, weighted_mean - weighted_std)
    confidence_high = weighted_mean + weighted_std

    return {
        "weighted_peak_wind_mph": round(weighted_mean, 2),
        "confidence_low_mph": round(confidence_low, 2),
        "confidence_high_mph": round(confidence_high, 2),
        "overall_qc_score": round(overall_qc, 4),
        "supporting_station_count": len(usable),
        "trace": {
            "usable": [
                {
                    "station_id": s["station_id"],
                    "distance_miles": s["distance_miles"],
                    "max_wind_mph": s["max_wind_mph"],
                    "avg_qc_score": s["avg_qc_score"],
                    "weight": round(s["weight"], 6),
                }
                for s in usable
            ],
            "rejected": rejected,
        },
    }


def _wind_confidence(peak_wind_mph: float, station_count: int, weighted_support: float) -> str:
    if station_count >= 2 and peak_wind_mph >= 58 and weighted_support >= 0.18:
        return "confirmed"
    if station_count >= 2 and peak_wind_mph >= 45 and weighted_support >= 0.12:
        return "high"
    if station_count >= 1 and peak_wind_mph >= 35:
        return "medium"
    if peak_wind_mph >= 25:
        return "low"
    return "unverified"


def build_wind_candidates(
    station_observations: Dict[str, List[Dict[str, Any]]],
    station_metadata: Dict[str, Dict[str, Any]],
    station_weight_map: Optional[Dict[str, float]] = None,
    min_wind_mph: float = 30.0,
) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    weights = station_weight_map or {}

    for station_id, observations in station_observations.items():
        for obs in observations:
            timestamp = obs.get("timestamp")
            parsed = _parse_timestamp(timestamp)
            if not parsed:
                continue

            wind_value = max(
                _safe_float(obs.get("wind_speed_mph")) or 0.0,
                _safe_float(obs.get("wind_gust_mph")) or 0.0,
                _safe_float(obs.get("peak_wind_gust_mph")) or 0.0,
            )
            if wind_value < min_wind_mph:
                continue

            day = parsed.strftime("%Y-%m-%d")
            bucket = grouped.setdefault(
                day,
                {
                    "candidate_date": day,
                    "peak_wind_mph": 0.0,
                    "peak_window_start": timestamp,
                    "peak_window_end": timestamp,
                    "observation_count": 0,
                    "station_ids": set(),
                },
            )

            bucket["peak_wind_mph"] = max(bucket["peak_wind_mph"], wind_value)
            bucket["observation_count"] += 1
            bucket["station_ids"].add(station_id)
            if timestamp < bucket["peak_window_start"]:
                bucket["peak_window_start"] = timestamp
            if timestamp > bucket["peak_window_end"]:
                bucket["peak_window_end"] = timestamp

    candidates: List[Dict[str, Any]] = []
    for _, bucket in grouped.items():
        station_ids = sorted(list(bucket["station_ids"]))
        weighted_support = sum(weights.get(station_id, 0.0) for station_id in station_ids)
        station_count = len(station_ids)
        confidence = _wind_confidence(bucket["peak_wind_mph"], station_count, weighted_support)
        score = (
            float(bucket["peak_wind_mph"]) * 0.65
            + float(station_count) * 12.0
            + float(weighted_support) * 40.0
        )

        stations_used = []
        for station_id in station_ids:
            meta = station_metadata.get(station_id, {})
            stations_used.append(
                {
                    "station_id": station_id,
                    "station_name": meta.get("station_name"),
                    "distance_miles": meta.get("distance_miles"),
                }
            )

        candidates.append(
            {
                "candidate_date": bucket["candidate_date"],
                "peak_window_start": bucket["peak_window_start"],
                "peak_window_end": bucket["peak_window_end"],
                "peak_wind_mph": round(float(bucket["peak_wind_mph"]), 2),
                "station_count": station_count,
                "observation_count": bucket["observation_count"],
                "weighted_support_score": round(weighted_support, 4),
                "confidence": confidence,
                "stations_used": stations_used,
                "score": round(score, 4),
            }
        )

    candidates.sort(key=lambda c: (c["score"], c["peak_wind_mph"]), reverse=True)
    return candidates


def _hail_confidence(report_count: int, min_distance_miles: float, max_hail_inches: float) -> str:
    if report_count >= 3 and min_distance_miles <= 10 and max_hail_inches >= 1.0:
        return "confirmed"
    if report_count >= 2 and min_distance_miles <= 15:
        return "high"
    if report_count >= 1 and min_distance_miles <= 25:
        return "medium"
    if report_count >= 1:
        return "low"
    return "unverified"


def build_hail_candidates(
    hail_reports: List[Dict[str, Any]],
    max_distance_miles: float = 25.0,
) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}

    for report in hail_reports:
        distance = _safe_float(report.get("distance_miles"))
        if distance is None or distance > max_distance_miles:
            continue

        ts = report.get("timestamp")
        parsed = _parse_timestamp(ts)
        if not parsed:
            continue

        day = parsed.strftime("%Y-%m-%d")
        magnitude = _safe_float(report.get("magnitude")) or 0.0
        bucket = grouped.setdefault(
            day,
            {
                "candidate_date": day,
                "report_count": 0,
                "max_hail_inches": 0.0,
                "min_distance_miles": distance,
                "peak_window_start": ts,
                "peak_window_end": ts,
                "source_reports": [],
            },
        )
        bucket["report_count"] += 1
        bucket["max_hail_inches"] = max(bucket["max_hail_inches"], magnitude)
        bucket["min_distance_miles"] = min(bucket["min_distance_miles"], distance)
        if ts < bucket["peak_window_start"]:
            bucket["peak_window_start"] = ts
        if ts > bucket["peak_window_end"]:
            bucket["peak_window_end"] = ts
        bucket["source_reports"].append(report)

    candidates: List[Dict[str, Any]] = []
    for _, bucket in grouped.items():
        confidence = _hail_confidence(
            int(bucket["report_count"]),
            float(bucket["min_distance_miles"]),
            float(bucket["max_hail_inches"]),
        )
        score = (
            float(bucket["report_count"]) * 18.0
            + float(bucket["max_hail_inches"]) * 22.0
            - float(bucket["min_distance_miles"]) * 0.35
        )
        candidates.append(
            {
                "candidate_date": bucket["candidate_date"],
                "peak_window_start": bucket["peak_window_start"],
                "peak_window_end": bucket["peak_window_end"],
                "report_count": int(bucket["report_count"]),
                "max_hail_inches": round(float(bucket["max_hail_inches"]), 2),
                "min_distance_miles": round(float(bucket["min_distance_miles"]), 2),
                "confidence": confidence,
                "score": round(score, 4),
                "source_reports": bucket["source_reports"],
            }
        )

    candidates.sort(
        key=lambda c: (c["score"], c["report_count"], c["max_hail_inches"]),
        reverse=True,
    )
    return candidates
