"""
Eden Incentives Engine - Rule Evaluator & Metric Pipeline
Phase 2: Real-time evaluation and leaderboard updates

This module handles:
1. Metric event ingestion from Harvest activities
2. Real-time rule evaluation (threshold, top_n, milestone)
3. Leaderboard calculation and rank updates
4. Notification triggers for achievements
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional, Tuple
import uuid
import logging

logger = logging.getLogger(__name__)


class IncentiveEvaluator:
    """
    Handles all competition evaluation logic including:
    - Threshold rules: Anyone hitting X qualifies
    - Top N rules: Top N performers win
    - Milestone rules: Multi-tier achievement chains
    - Improvement rules: Beat baseline by X%
    - Lottery rules: Random draw from qualifiers
    """
    
    def __init__(self, db):
        self.db = db
    
    async def process_metric_event(
        self,
        user_id: str,
        metric_slug: str,
        value: int = 1,
        event_type: str = "increment",
        source_collection: str = "",
        source_document_id: str = ""
    ) -> Dict[str, Any]:
        """
        Process a new metric event (e.g., door knocked, appointment set)
        
        This is the main entry point for the metric pipeline.
        Returns affected competitions and any triggered notifications.
        """
        now = datetime.now(timezone.utc).isoformat()
        results = {
            "affected_competitions": [],
            "notifications": [],
            "rank_changes": [],
            "qualifications": []
        }
        
        # 1. Find the metric
        metric = await self.db.incentive_metrics.find_one({"slug": metric_slug})
        if not metric:
            logger.warning(f"Unknown metric slug: {metric_slug}")
            return results
        
        metric_id = metric["id"]
        
        # 2. Record the raw event
        event_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "metric_id": metric_id,
            "event_type": event_type,
            "source_collection": source_collection,
            "source_document_id": source_document_id,
            "value": value,
            "competition_ids": [],
            "created_at": now
        }
        
        # 3. Find active competitions using this metric
        active_competitions = await self.db.incentive_competitions.find({
            "metric_id": metric_id,
            "status": "active"
        }).to_list(50)
        
        competition_ids = [c["id"] for c in active_competitions]
        event_doc["competition_ids"] = competition_ids
        
        # 4. Store the event
        await self.db.incentive_metric_events.insert_one(event_doc)
        
        # 5. Update participant values in each competition
        for competition in active_competitions:
            comp_result = await self._update_competition_participant(
                competition, user_id, value, now
            )
            
            if comp_result:
                results["affected_competitions"].append(comp_result["competition_id"])
                results["notifications"].extend(comp_result.get("notifications", []))
                results["rank_changes"].extend(comp_result.get("rank_changes", []))
                results["qualifications"].extend(comp_result.get("qualifications", []))
        
        return results
    
    async def _update_competition_participant(
        self,
        competition: Dict[str, Any],
        user_id: str,
        value_delta: int,
        timestamp: str
    ) -> Optional[Dict[str, Any]]:
        """Update a participant's value and evaluate rules"""
        
        competition_id = competition["id"]
        result = {
            "competition_id": competition_id,
            "notifications": [],
            "rank_changes": [],
            "qualifications": []
        }
        
        # Find participant
        participant = await self.db.incentive_participants.find_one({
            "competition_id": competition_id,
            "user_id": user_id
        })
        
        if not participant:
            # User not in this competition
            return None
        
        # Store previous state for comparison
        old_value = participant.get("current_value", 0)
        old_rank = participant.get("rank")
        old_qualified_rules = participant.get("qualified_rules", [])
        
        # Update value
        new_value = old_value + value_delta
        
        # Update participant document
        update_doc = {
            "current_value": new_value,
            "previous_value": old_value,
            "last_activity_at": timestamp,
            "activity_count": participant.get("activity_count", 0) + 1,
            "updated_at": timestamp
        }
        
        # Track peak
        if new_value > participant.get("peak_value", 0):
            update_doc["peak_value"] = new_value
        
        await self.db.incentive_participants.update_one(
            {"id": participant["id"]},
            {"$set": update_doc}
        )
        
        # Recalculate ranks for this competition
        rank_result = await self._recalculate_ranks(competition_id, user_id)
        new_rank = rank_result.get("user_rank")
        
        if new_rank and old_rank and new_rank != old_rank:
            result["rank_changes"].append({
                "user_id": user_id,
                "competition_id": competition_id,
                "old_rank": old_rank,
                "new_rank": new_rank,
                "direction": "up" if new_rank < old_rank else "down"
            })
            
            # Notification for rank improvement
            if new_rank < old_rank:
                result["notifications"].append({
                    "type": "rank_improved",
                    "user_id": user_id,
                    "competition_id": competition_id,
                    "title": f"You're now #{new_rank}!",
                    "body": f"You moved up from #{old_rank}. Keep pushing!",
                    "data": {"old_rank": old_rank, "new_rank": new_rank}
                })
        
        # Evaluate rules
        rules = await self.db.incentive_rules.find({
            "competition_id": competition_id
        }).sort("priority", 1).to_list(20)
        
        for rule in rules:
            rule_result = await self._evaluate_rule(
                rule, participant, new_value, old_value, old_qualified_rules, competition
            )
            
            if rule_result.get("newly_qualified"):
                result["qualifications"].append(rule_result)
                result["notifications"].extend(rule_result.get("notifications", []))
                
                # Update participant qualified_rules
                await self.db.incentive_participants.update_one(
                    {"id": participant["id"]},
                    {"$addToSet": {"qualified_rules": rule["id"]}}
                )
        
        return result
    
    async def _recalculate_ranks(
        self,
        competition_id: str,
        affected_user_id: str = None
    ) -> Dict[str, Any]:
        """Recalculate ranks for all participants in a competition"""
        
        # Get all participants sorted by value
        participants = await self.db.incentive_participants.find(
            {"competition_id": competition_id}
        ).sort("current_value", -1).to_list(1000)
        
        result = {"updated_count": 0, "user_rank": None}
        
        # Assign ranks
        for i, participant in enumerate(participants):
            new_rank = i + 1
            old_rank = participant.get("rank")
            
            if old_rank != new_rank:
                await self.db.incentive_participants.update_one(
                    {"id": participant["id"]},
                    {
                        "$set": {
                            "rank": new_rank,
                            "previous_rank": old_rank,
                            "percentile": ((len(participants) - new_rank + 1) / len(participants)) * 100 if participants else 0
                        }
                    }
                )
                result["updated_count"] += 1
            
            if affected_user_id and participant["user_id"] == affected_user_id:
                result["user_rank"] = new_rank
        
        return result
    
    async def _evaluate_rule(
        self,
        rule: Dict[str, Any],
        participant: Dict[str, Any],
        new_value: int,
        old_value: int,
        old_qualified_rules: List[str],
        competition: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Evaluate a single rule against participant's progress"""
        
        result = {
            "rule_id": rule["id"],
            "rule_type": rule["type"],
            "newly_qualified": False,
            "notifications": []
        }
        
        # Skip if already qualified for this rule
        if rule["id"] in old_qualified_rules:
            return result
        
        rule_type = rule.get("type")
        user_id = participant["user_id"]
        
        # THRESHOLD RULE
        if rule_type == "threshold":
            threshold_value = rule.get("threshold_value", 0)
            
            # Check if just crossed threshold
            if new_value >= threshold_value and old_value < threshold_value:
                result["newly_qualified"] = True
                result["notifications"].append({
                    "type": "threshold_reached",
                    "user_id": user_id,
                    "competition_id": competition["id"],
                    "title": "🎯 Threshold Reached!",
                    "body": f"You hit {threshold_value}! You've qualified for rewards.",
                    "data": {
                        "threshold": threshold_value,
                        "current_value": new_value,
                        "points_earned": rule.get("points_award", 0)
                    }
                })
            
            # Check if approaching threshold (90%+)
            elif new_value >= threshold_value * 0.9 and old_value < threshold_value * 0.9:
                gap = threshold_value - new_value
                result["notifications"].append({
                    "type": "threshold_approaching",
                    "user_id": user_id,
                    "competition_id": competition["id"],
                    "title": "Almost There!",
                    "body": f"Just {gap} more to qualify!",
                    "data": {"threshold": threshold_value, "gap": gap}
                })
        
        # TOP_N RULE (evaluated at competition end, but track position)
        elif rule_type == "top_n":
            top_n = rule.get("top_n", 3)
            current_rank = participant.get("rank")
            
            if current_rank and current_rank <= top_n:
                # In winning position but don't mark qualified until competition ends
                pass
        
        # MILESTONE RULE
        elif rule_type == "milestone":
            milestones = rule.get("milestones", [])
            current_milestone = participant.get("milestone_reached")
            
            for milestone in sorted(milestones, key=lambda m: m["value"], reverse=True):
                if new_value >= milestone["value"]:
                    if current_milestone != milestone["tier"]:
                        # Check if this is a new milestone (not previously reached)
                        old_milestone_idx = next(
                            (i for i, m in enumerate(milestones) if m["tier"] == current_milestone),
                            -1
                        )
                        new_milestone_idx = next(
                            (i for i, m in enumerate(milestones) if m["tier"] == milestone["tier"]),
                            -1
                        )
                        
                        if new_milestone_idx > old_milestone_idx or current_milestone is None:
                            result["newly_qualified"] = True
                            result["milestone_tier"] = milestone["tier"]
                            result["notifications"].append({
                                "type": "milestone_reached",
                                "user_id": user_id,
                                "competition_id": competition["id"],
                                "title": f"🏆 {milestone['tier'].title()} Unlocked!",
                                "body": f"You reached {milestone['value']}! +{milestone.get('points_award', 0)} points",
                                "data": {
                                    "tier": milestone["tier"],
                                    "value": milestone["value"],
                                    "points_earned": milestone.get("points_award", 0)
                                }
                            })
                            
                            # Update participant milestone
                            await self.db.incentive_participants.update_one(
                                {"id": participant["id"]},
                                {"$set": {"milestone_reached": milestone["tier"]}}
                            )
                    break
        
        # IMPROVEMENT RULE
        elif rule_type == "improvement":
            improvement_percent = rule.get("improvement_percent", 0)
            baseline_value = participant.get("baseline_value", 0)
            
            if baseline_value > 0:
                current_improvement = ((new_value - baseline_value) / baseline_value) * 100
                required_improvement = improvement_percent
                
                # Check if just crossed the improvement threshold
                old_improvement = ((old_value - baseline_value) / baseline_value) * 100 if baseline_value > 0 else 0
                
                if current_improvement >= required_improvement and old_improvement < required_improvement:
                    result["newly_qualified"] = True
                    result["improvement_achieved"] = current_improvement
                    result["notifications"].append({
                        "type": "improvement_achieved",
                        "user_id": user_id,
                        "competition_id": competition["id"],
                        "title": "📈 Personal Best!",
                        "body": f"You beat your baseline by {current_improvement:.1f}%! Goal was {required_improvement}%.",
                        "data": {
                            "baseline_value": baseline_value,
                            "current_value": new_value,
                            "improvement_percent": current_improvement,
                            "required_percent": required_improvement,
                            "points_earned": rule.get("points_award", 0)
                        }
                    })
                    
                    # Update participant improvement
                    await self.db.incentive_participants.update_one(
                        {"id": participant["id"]},
                        {"$set": {"improvement_percent": current_improvement}}
                    )
                
                # Notify when approaching improvement target (80%+)
                elif current_improvement >= required_improvement * 0.8 and old_improvement < required_improvement * 0.8:
                    gap_percent = required_improvement - current_improvement
                    result["notifications"].append({
                        "type": "improvement_approaching",
                        "user_id": user_id,
                        "competition_id": competition["id"],
                        "title": "Almost There!",
                        "body": f"Just {gap_percent:.1f}% more to beat your baseline!",
                        "data": {"current_improvement": current_improvement, "target": required_improvement}
                    })
        
        # LOTTERY RULE (track qualifier status in real-time)
        elif rule_type == "lottery":
            qualifier_threshold = rule.get("lottery_qualifier_threshold", 0)
            
            # Check if just qualified for lottery entry
            if new_value >= qualifier_threshold and old_value < qualifier_threshold:
                result["notifications"].append({
                    "type": "lottery_qualified",
                    "user_id": user_id,
                    "competition_id": competition["id"],
                    "title": "🎰 You're In The Draw!",
                    "body": f"You hit {qualifier_threshold} and are now entered in the lottery!",
                    "data": {
                        "threshold": qualifier_threshold,
                        "current_value": new_value,
                        "lottery_winner_count": rule.get("lottery_winner_count", 1)
                    }
                })
                
                # Mark as lottery qualifier
                await self.db.incentive_participants.update_one(
                    {"id": participant["id"]},
                    {"$set": {"is_lottery_qualifier": True}}
                )
        
        return result
    
    async def evaluate_competition_end(self, competition_id: str) -> Dict[str, Any]:
        """
        Full evaluation at competition end.
        Creates CompetitionResult records, awards badges, and triggers notifications.
        """
        
        competition = await self.db.incentive_competitions.find_one({"id": competition_id})
        if not competition:
            return {"error": "Competition not found"}
        
        if competition["status"] != "active":
            return {"error": f"Competition is {competition['status']}, not active"}
        
        now = datetime.now(timezone.utc).isoformat()
        
        # Mark as evaluating
        await self.db.incentive_competitions.update_one(
            {"id": competition_id},
            {"$set": {"status": "evaluating", "updated_at": now}}
        )
        
        # Get rules and participants
        rules = await self.db.incentive_rules.find(
            {"competition_id": competition_id}
        ).sort("priority", 1).to_list(20)
        
        participants = await self.db.incentive_participants.find(
            {"competition_id": competition_id}
        ).sort("current_value", -1).to_list(1000)
        
        results = []
        awarded_user_rule_combos = set()  # Prevent double awards
        notifications = []  # Collect all end notifications
        badges_awarded = []  # Track badge awards
        
        for rule in rules:
            rule_results = await self._evaluate_rule_final(
                rule, participants, competition, now, awarded_user_rule_combos
            )
            results.extend(rule_results)
            
            for r in rule_results:
                awarded_user_rule_combos.add((r["user_id"], r["rule_id"]))
        
        # Insert results
        if results:
            await self.db.incentive_results.insert_many(results)
        
        # Award points and badges
        for result in results:
            user_id = result["user_id"]
            
            # Award points
            if result.get("points_awarded", 0) > 0:
                await self.db.harvest_user_stats.update_one(
                    {"user_id": user_id},
                    {"$inc": {"total_points": result["points_awarded"]}},
                    upsert=True
                )
            
            # Award badge if specified
            badge_id = result.get("badge_id")
            if badge_id:
                badge_award = await self._award_badge(
                    user_id, badge_id, competition_id, result["qualification_reason"], now
                )
                if badge_award:
                    badges_awarded.append(badge_award)
                    notifications.append({
                        "type": "badge_earned",
                        "user_id": user_id,
                        "title": f"🏅 Badge Earned: {badge_award.get('badge_name', 'Unknown')}",
                        "body": f"You earned the {badge_award.get('badge_name')} badge for {result['qualification_reason']}!",
                        "data": badge_award
                    })
            
            # Send result notification
            notifications.append({
                "type": "competition_result",
                "user_id": user_id,
                "title": "🎉 Competition Complete!",
                "body": f"You finished #{result['final_rank']} in {competition['name']}! +{result.get('points_awarded', 0)} points",
                "data": {
                    "competition_id": competition_id,
                    "competition_name": competition["name"],
                    "final_rank": result["final_rank"],
                    "final_value": result["final_value"],
                    "points_awarded": result.get("points_awarded", 0),
                    "qualification_reason": result["qualification_reason"]
                }
            })
        
        # Send participation notification to all participants who didn't qualify
        qualified_user_ids = {r["user_id"] for r in results}
        for participant in participants:
            if participant["user_id"] not in qualified_user_ids:
                notifications.append({
                    "type": "competition_ended",
                    "user_id": participant["user_id"],
                    "title": "Competition Ended",
                    "body": f"{competition['name']} has ended. You finished #{participant.get('rank', '?')} with {participant['current_value']} {competition.get('metric_snapshot', {}).get('unit', 'points')}.",
                    "data": {
                        "competition_id": competition_id,
                        "final_rank": participant.get("rank"),
                        "final_value": participant["current_value"]
                    }
                })
        
        # Store notifications in database
        if notifications:
            notification_docs = []
            for notif in notifications:
                notification_docs.append({
                    "id": str(uuid.uuid4()),
                    "user_id": notif["user_id"],
                    "type": notif["type"],
                    "title": notif["title"],
                    "body": notif["body"],
                    "data": notif.get("data", {}),
                    "read": False,
                    "created_at": now
                })
            await self.db.notifications.insert_many(notification_docs)
        
        # Mark as completed
        await self.db.incentive_competitions.update_one(
            {"id": competition_id},
            {
                "$set": {
                    "status": "completed",
                    "evaluated_at": now,
                    "qualified_count": len(results),
                    "updated_at": now
                }
            }
        )
        
        # Update season standings if applicable
        if competition.get("season_id"):
            await self._update_season_standings(competition["season_id"])
        
        return {
            "competition_id": competition_id,
            "competition_name": competition["name"],
            "results_count": len(results),
            "results": results,
            "badges_awarded": badges_awarded,
            "notifications_sent": len(notifications)
        }
    
    async def _award_badge(
        self,
        user_id: str,
        badge_id: str,
        competition_id: str,
        reason: str,
        timestamp: str
    ) -> Optional[Dict[str, Any]]:
        """Award a badge to a user if not already earned"""
        
        # Check if badge exists
        badge = await self.db.harvest_badges.find_one({"id": badge_id})
        if not badge:
            logger.warning(f"Badge not found: {badge_id}")
            return None
        
        # Check if already earned
        existing = await self.db.user_badges.find_one({
            "user_id": user_id,
            "badge_id": badge_id
        })
        
        if existing:
            return None  # Already has this badge
        
        # Award the badge
        badge_award = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "badge_id": badge_id,
            "badge_name": badge.get("name", "Unknown"),
            "badge_icon": badge.get("icon", "🏅"),
            "badge_tier": badge.get("tier", "common"),
            "competition_id": competition_id,
            "earned_reason": reason,
            "earned_at": timestamp
        }
        
        await self.db.user_badges.insert_one(badge_award)
        
        return badge_award
    
    async def _evaluate_rule_final(
        self,
        rule: Dict[str, Any],
        participants: List[Dict[str, Any]],
        competition: Dict[str, Any],
        timestamp: str,
        awarded_combos: set
    ) -> List[Dict[str, Any]]:
        """Evaluate a rule at competition end and create results"""
        
        results = []
        rule_type = rule.get("type")
        competition_id = competition["id"]
        
        if rule_type == "top_n":
            top_n = rule.get("top_n", 3)
            reward_tiers = rule.get("reward_tiers", [])
            
            for rank, participant in enumerate(participants[:top_n], 1):
                if (participant["user_id"], rule["id"]) in awarded_combos:
                    continue
                
                # Find reward for this rank
                tier_reward = next(
                    (t for t in reward_tiers if t["rank"] == rank),
                    None
                )
                
                result = {
                    "id": str(uuid.uuid4()),
                    "competition_id": competition_id,
                    "user_id": participant["user_id"],
                    "user_name": participant.get("user_name", "Unknown"),
                    "final_rank": rank,
                    "final_value": participant["current_value"],
                    "final_percentile": participant.get("percentile", 0),
                    "rule_id": rule["id"],
                    "rule_type": rule_type,
                    "qualification_reason": f"Top {top_n} - Rank #{rank}",
                    "points_awarded": tier_reward.get("bonus_points", 0) if tier_reward else rule.get("points_award", 0),
                    "reward_id": tier_reward.get("reward_id") if tier_reward else rule.get("reward_id"),
                    "badge_id": rule.get("badge_id"),
                    "fulfillment_status": "pending",
                    "created_at": timestamp
                }
                results.append(result)
        
        elif rule_type == "threshold":
            threshold_value = rule.get("threshold_value", 0)
            max_winners = rule.get("max_winners")
            
            qualifiers = [p for p in participants if p["current_value"] >= threshold_value]
            
            if max_winners:
                qualifiers = qualifiers[:max_winners]
            
            for participant in qualifiers:
                if (participant["user_id"], rule["id"]) in awarded_combos:
                    continue
                
                rank = next(
                    (i + 1 for i, p in enumerate(participants) if p["user_id"] == participant["user_id"]),
                    0
                )
                
                result = {
                    "id": str(uuid.uuid4()),
                    "competition_id": competition_id,
                    "user_id": participant["user_id"],
                    "user_name": participant.get("user_name", "Unknown"),
                    "final_rank": rank,
                    "final_value": participant["current_value"],
                    "final_percentile": participant.get("percentile", 0),
                    "rule_id": rule["id"],
                    "rule_type": rule_type,
                    "qualification_reason": f"Threshold: {participant['current_value']} >= {threshold_value}",
                    "points_awarded": rule.get("points_award", 0),
                    "reward_id": rule.get("reward_id"),
                    "badge_id": rule.get("badge_id"),
                    "fulfillment_status": "pending",
                    "created_at": timestamp
                }
                results.append(result)
        
        elif rule_type == "milestone":
            milestones = rule.get("milestones", [])
            
            for participant in participants:
                if (participant["user_id"], rule["id"]) in awarded_combos:
                    continue
                
                reached_milestone = participant.get("milestone_reached")
                if not reached_milestone:
                    continue
                
                milestone_config = next(
                    (m for m in milestones if m["tier"] == reached_milestone),
                    None
                )
                
                if not milestone_config:
                    continue
                
                rank = next(
                    (i + 1 for i, p in enumerate(participants) if p["user_id"] == participant["user_id"]),
                    0
                )
                
                result = {
                    "id": str(uuid.uuid4()),
                    "competition_id": competition_id,
                    "user_id": participant["user_id"],
                    "user_name": participant.get("user_name", "Unknown"),
                    "final_rank": rank,
                    "final_value": participant["current_value"],
                    "final_percentile": participant.get("percentile", 0),
                    "rule_id": rule["id"],
                    "rule_type": rule_type,
                    "qualification_reason": f"Milestone: {reached_milestone.title()} Tier",
                    "points_awarded": milestone_config.get("points_award", 0),
                    "reward_id": milestone_config.get("reward_id"),
                    "badge_id": milestone_config.get("badge_id"),
                    "fulfillment_status": "pending",
                    "created_at": timestamp
                }
                results.append(result)
        
        elif rule_type == "lottery":
            qualifier_threshold = rule.get("lottery_qualifier_threshold", 0)
            winner_count = rule.get("lottery_winner_count", 1)
            
            qualifiers = [p for p in participants if p["current_value"] >= qualifier_threshold]
            
            if qualifiers:
                import random
                seed = rule.get("lottery_seed") or str(uuid.uuid4())
                random.seed(seed)
                winners = random.sample(qualifiers, min(winner_count, len(qualifiers)))
                
                # Record lottery draw
                await self.db.incentive_rules.update_one(
                    {"id": rule["id"]},
                    {"$set": {"lottery_drawn_at": timestamp, "lottery_seed": seed}}
                )
                
                for participant in winners:
                    if (participant["user_id"], rule["id"]) in awarded_combos:
                        continue
                    
                    rank = next(
                        (i + 1 for i, p in enumerate(participants) if p["user_id"] == participant["user_id"]),
                        0
                    )
                    
                    result = {
                        "id": str(uuid.uuid4()),
                        "competition_id": competition_id,
                        "user_id": participant["user_id"],
                        "user_name": participant.get("user_name", "Unknown"),
                        "final_rank": rank,
                        "final_value": participant["current_value"],
                        "final_percentile": participant.get("percentile", 0),
                        "rule_id": rule["id"],
                        "rule_type": rule_type,
                        "qualification_reason": f"Lottery Winner (from {len(qualifiers)} qualifiers)",
                        "points_awarded": rule.get("points_award", 0),
                        "reward_id": rule.get("reward_id"),
                        "badge_id": rule.get("badge_id"),
                        "fulfillment_status": "pending",
                        "created_at": timestamp
                    }
                    results.append(result)
        
        # IMPROVEMENT RULE FINAL EVALUATION
        elif rule_type == "improvement":
            improvement_percent = rule.get("improvement_percent", 0)
            
            for participant in participants:
                if (participant["user_id"], rule["id"]) in awarded_combos:
                    continue
                
                baseline_value = participant.get("baseline_value", 0)
                if baseline_value <= 0:
                    continue
                
                actual_improvement = ((participant["current_value"] - baseline_value) / baseline_value) * 100
                
                if actual_improvement >= improvement_percent:
                    rank = next(
                        (i + 1 for i, p in enumerate(participants) if p["user_id"] == participant["user_id"]),
                        0
                    )
                    
                    result = {
                        "id": str(uuid.uuid4()),
                        "competition_id": competition_id,
                        "user_id": participant["user_id"],
                        "user_name": participant.get("user_name", "Unknown"),
                        "final_rank": rank,
                        "final_value": participant["current_value"],
                        "final_percentile": participant.get("percentile", 0),
                        "rule_id": rule["id"],
                        "rule_type": rule_type,
                        "qualification_reason": f"Improvement: {actual_improvement:.1f}% (beat {improvement_percent}% target)",
                        "points_awarded": rule.get("points_award", 0),
                        "reward_id": rule.get("reward_id"),
                        "badge_id": rule.get("badge_id"),
                        "fulfillment_status": "pending",
                        "improvement_achieved": actual_improvement,
                        "baseline_value": baseline_value,
                        "created_at": timestamp
                    }
                    results.append(result)
        
        return results
    
    async def _update_season_standings(self, season_id: str):
        """Update season standings after a competition completes"""
        
        # Get all completed competitions in this season
        competitions = await self.db.incentive_competitions.find({
            "season_id": season_id,
            "status": "completed"
        }).to_list(100)
        
        # Aggregate points per user
        user_points = {}
        user_names = {}
        user_wins = {}
        user_entries = {}
        
        for comp in competitions:
            results = await self.db.incentive_results.find({
                "competition_id": comp["id"]
            }).to_list(1000)
            
            for result in results:
                user_id = result["user_id"]
                points = result.get("points_awarded", 0)
                
                user_points[user_id] = user_points.get(user_id, 0) + points
                user_names[user_id] = result.get("user_name", "Unknown")
                user_entries[user_id] = user_entries.get(user_id, 0) + 1
                
                if result.get("final_rank") == 1:
                    user_wins[user_id] = user_wins.get(user_id, 0) + 1
        
        # Create/update standings
        now = datetime.now(timezone.utc).isoformat()
        
        for user_id, total_points in user_points.items():
            standing_doc = {
                "season_id": season_id,
                "user_id": user_id,
                "user_name": user_names.get(user_id, "Unknown"),
                "total_points": total_points,
                "competitions_entered": user_entries.get(user_id, 0),
                "competitions_won": user_wins.get(user_id, 0),
                "updated_at": now
            }
            
            await self.db.incentive_season_standings.update_one(
                {"season_id": season_id, "user_id": user_id},
                {"$set": standing_doc},
                upsert=True
            )
        
        # Determine champion (highest points)
        if user_points:
            champion_id = max(user_points.keys(), key=lambda uid: user_points[uid])
            await self.db.incentive_seasons.update_one(
                {"id": season_id},
                {"$set": {"champion_user_id": champion_id, "updated_at": now}}
            )


# Metric mapping for Harvest events
HARVEST_METRIC_MAP = {
    "visit_logged": {
        "NH": [("doors", 1)],  # No Home
        "NI": [("doors", 1), ("contacts", 1)],  # Not Interested
        "CB": [("doors", 1), ("contacts", 1)],  # Call Back
        "AP": [("doors", 1), ("contacts", 1), ("appointments", 1)],  # Appointment
        "SG": [("doors", 1), ("contacts", 1), ("contracts", 1)],  # Signed
    },
    "review_collected": [("reviews", 1)],
    "referral_generated": [("referrals", 1)],
    "install_completed": [("installs", 1)],
}


async def process_harvest_event(
    db,
    user_id: str,
    event_type: str,
    status: str = None,
    value: int = 1,
    source_collection: str = "",
    source_document_id: str = ""
) -> Dict[str, Any]:
    """
    Bridge function to process Harvest events through the Incentive Engine.
    Called from harvest routes when activities occur.
    """
    
    evaluator = IncentiveEvaluator(db)
    all_results = {
        "affected_competitions": [],
        "notifications": [],
        "rank_changes": [],
        "qualifications": []
    }
    
    # Determine which metrics to update
    metrics_to_update = []
    
    if event_type == "visit_logged" and status:
        status_metrics = HARVEST_METRIC_MAP.get("visit_logged", {}).get(status, [])
        metrics_to_update.extend(status_metrics)
    elif event_type in HARVEST_METRIC_MAP:
        metrics_to_update.extend(HARVEST_METRIC_MAP[event_type])
    
    # Process each metric
    for metric_slug, metric_value in metrics_to_update:
        result = await evaluator.process_metric_event(
            user_id=user_id,
            metric_slug=metric_slug,
            value=metric_value * value,
            event_type=event_type,
            source_collection=source_collection,
            source_document_id=source_document_id
        )
        
        all_results["affected_competitions"].extend(result.get("affected_competitions", []))
        all_results["notifications"].extend(result.get("notifications", []))
        all_results["rank_changes"].extend(result.get("rank_changes", []))
        all_results["qualifications"].extend(result.get("qualifications", []))
    
    # Deduplicate
    all_results["affected_competitions"] = list(set(all_results["affected_competitions"]))
    
    return all_results
