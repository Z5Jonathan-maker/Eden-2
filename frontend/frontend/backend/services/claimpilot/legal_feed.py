"""
LegalFeedService — Fetches and caches FL insurance statutes for StatuteMatcher.

Scrapes the FL Legislature site for statute text, stores in MongoDB
with content hashing for change detection. Falls back to hardcoded
summaries when scraping fails.

DISCLAIMER: Automated statute retrieval for reference only.
Not legal advice. Consult an attorney for legal questions.
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone
from html import unescape
from typing import Any, Optional

import aiohttp

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

STALENESS_WARNING_DAYS = 7
STALENESS_ERROR_DAYS = 30
SCRAPE_TIMEOUT_SECONDS = 30
FL_STATUTES_BASE_URL = "http://www.leg.state.fl.us/statutes/"

# ── Statute registry ─────────────────────────────────────────────────────────

STATUTE_REGISTRY: list[dict[str, Any]] = [
    {
        "statute_number": "627.70131",
        "title": "Claims administration",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.70131.html"
        ),
        "deadlines": [
            {"action": "acknowledge_claim", "days": 14, "trigger": "claim_filed"},
            {"action": "begin_investigation", "days": 10, "trigger": "claim_filed"},
            {"action": "pay_or_deny", "days": 90, "trigger": "proof_of_loss"},
        ],
        "fallback_summary": (
            "Carrier must acknowledge receipt of claim within 14 days, "
            "begin investigation within 10 days, and pay or deny within "
            "90 days of proof of loss."
        ),
    },
    {
        "statute_number": "627.70132",
        "title": "Insurer's duty to acknowledge communications",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.70132.html"
        ),
        "deadlines": [],
        "fallback_summary": (
            "Insurer must acknowledge and act upon communications from "
            "claimants, policyholders, or their representatives."
        ),
    },
    {
        "statute_number": "627.7015",
        "title": "Attorney fees",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.7015.html"
        ),
        "deadlines": [],
        "fallback_summary": "Provisions for attorney fees in insurance disputes.",
    },
    {
        "statute_number": "627.428",
        "title": "Attorney fees (prevailing insured)",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.428.html"
        ),
        "deadlines": [],
        "fallback_summary": (
            "Prevailing insured or beneficiary is entitled to reasonable "
            "attorney fees and costs upon judgment or decree."
        ),
    },
    {
        "statute_number": "626.9541",
        "title": "Unfair claim settlement practices",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0626/Sections/0626.9541.html"
        ),
        "deadlines": [],
        "fallback_summary": (
            "Defines unfair methods of competition and unfair or deceptive "
            "acts, including failing to promptly settle claims when liability "
            "is reasonably clear."
        ),
    },
    {
        "statute_number": "627.701",
        "title": "Valued policy law",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.701.html"
        ),
        "deadlines": [],
        "fallback_summary": (
            "In case of total loss of a structure, the insurer must pay "
            "the amount of insurance specified in the policy."
        ),
    },
    {
        "statute_number": "627.7011",
        "title": "Residential coverage",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.7011.html"
        ),
        "deadlines": [],
        "fallback_summary": (
            "Requirements for residential property insurance coverage "
            "including required and optional coverages."
        ),
    },
    {
        "statute_number": "627.702",
        "title": "Replacement cost coverage",
        "source_url": (
            f"{FL_STATUTES_BASE_URL}"
            "index.cfm?App_mode=Display_Statute&URL=0600-0699/0627/Sections/0627.702.html"
        ),
        "deadlines": [],
        "fallback_summary": (
            "Provisions governing replacement cost coverage and how "
            "replacement cost value is determined."
        ),
    },
]

COLLECTION_NAME = "claimpilot_legal_feed"


# ── HTML parsing helpers ──────────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    """Remove HTML tags and decode entities, preserving readable whitespace."""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _compute_hash(text: str) -> str:
    """SHA-256 content hash for change detection."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── Service ───────────────────────────────────────────────────────────────────


class LegalFeedService:
    """Fetches and caches FL insurance statutes in MongoDB."""

    def __init__(self, db: Any) -> None:
        self.db = db
        self._collection = db[COLLECTION_NAME]

    # ── Public API ────────────────────────────────────────────────────────

    async def sync_statutes(self, force: bool = False) -> dict:
        """Fetch latest FL statutes and store in claimpilot_legal_feed.

        Returns ``{"updated": int, "unchanged": int, "errors": []}``.
        When *force* is False, statutes whose content hash hasn't changed
        are skipped (upsert with hash comparison).
        """
        updated = 0
        unchanged = 0
        errors: list[str] = []
        now = datetime.now(timezone.utc)

        for entry in STATUTE_REGISTRY:
            statute_number = entry["statute_number"]
            try:
                full_text = await self._fetch_statute_text(entry["source_url"])
                used_fallback = False
            except Exception as exc:
                logger.warning(
                    "legal_feed statute=%s scrape failed, using fallback: %s",
                    statute_number,
                    exc,
                )
                full_text = entry["fallback_summary"]
                used_fallback = True
                errors.append(f"{statute_number}: scrape failed ({exc})")

            content_hash = _compute_hash(full_text)

            if not force:
                existing = await self._collection.find_one(
                    {"statute_number": statute_number}
                )
                if existing and existing.get("content_hash") == content_hash:
                    unchanged += 1
                    continue

            doc = {
                "statute_number": statute_number,
                "title": entry["title"],
                "full_text": full_text,
                "summary": entry["fallback_summary"],
                "effective_date": None,
                "last_amended": None,
                "source_url": entry["source_url"],
                "fetched_at": now,
                "content_hash": content_hash,
                "deadlines": entry["deadlines"],
                "used_fallback": used_fallback,
            }

            await self._collection.update_one(
                {"statute_number": statute_number},
                {"$set": doc},
                upsert=True,
            )
            updated += 1

        # Record last sync timestamp in a meta document
        await self._collection.update_one(
            {"_meta": "sync_status"},
            {"$set": {"_meta": "sync_status", "last_sync": now}},
            upsert=True,
        )

        logger.info(
            "legal_feed sync complete: updated=%d unchanged=%d errors=%d",
            updated,
            unchanged,
            len(errors),
        )
        return {"updated": updated, "unchanged": unchanged, "errors": errors}

    async def get_statute(self, statute_number: str) -> Optional[dict]:
        """Get a specific statute from the cache."""
        doc = await self._collection.find_one(
            {"statute_number": statute_number}
        )
        if doc:
            doc.pop("_id", None)
        return doc

    async def get_all_statutes(self) -> list:
        """Get all cached statutes (excludes meta docs)."""
        cursor = self._collection.find(
            {"statute_number": {"$ne": None}, "_meta": {"$ne": "sync_status"}},
        )
        docs = await cursor.to_list(length=100)
        for doc in docs:
            doc.pop("_id", None)
        return docs

    async def check_staleness(self) -> dict:
        """Check if legal feed is stale.

        Returns ``{"is_stale": bool, "last_sync": datetime|None, "days_since_sync": int}``.
        """
        meta = await self._collection.find_one({"_meta": "sync_status"})
        if not meta or "last_sync" not in meta:
            return {
                "is_stale": True,
                "last_sync": None,
                "days_since_sync": -1,
            }

        last_sync: datetime = meta["last_sync"]
        if not isinstance(last_sync, datetime):
            return {"is_stale": True, "last_sync": None, "days_since_sync": -1}

        now = datetime.now(timezone.utc)
        delta = now - last_sync
        days = delta.days
        is_stale = days >= STALENESS_WARNING_DAYS

        if days >= STALENESS_ERROR_DAYS:
            logger.error(
                "legal_feed CRITICALLY STALE: %d days since last sync", days
            )
        elif is_stale:
            logger.warning(
                "legal_feed stale: %d days since last sync", days
            )

        return {
            "is_stale": is_stale,
            "last_sync": last_sync,
            "days_since_sync": days,
        }

    # ── Internal ──────────────────────────────────────────────────────────

    async def _fetch_statute_text(self, url: str) -> str:
        """Scrape statute full text from the FL Legislature website."""
        timeout = aiohttp.ClientTimeout(total=SCRAPE_TIMEOUT_SECONDS)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as resp:
                resp.raise_for_status()
                html = await resp.text()

        # The FL Legislature site wraps statute text in a specific pattern.
        # Try to extract the statute body between common markers.
        body = self._extract_statute_body(html)
        if not body:
            raise ValueError(f"Could not parse statute body from {url}")
        return body

    @staticmethod
    def _extract_statute_body(html: str) -> Optional[str]:
        """Extract statute text from FL Legislature HTML page.

        The page typically contains the statute text inside a section
        bounded by identifiable markers. We try several patterns.
        """
        # Pattern 1: content between "Statutes & Constitution" markers
        patterns = [
            # The statute text is often inside a <div class="Content">
            r'<div[^>]*class="Content"[^>]*>(.*?)</div>',
            # Or inside the main content area after the title
            r'<div[^>]*class="Statute"[^>]*>(.*?)</div>',
            # Broader: grab everything between <body> markers after title line
            r'(?:627\.\d+|626\.\d+).*?</h\d>(.+?)(?:<div class="Footer|</body>)',
        ]
        for pattern in patterns:
            match = re.search(pattern, html, re.DOTALL | re.IGNORECASE)
            if match:
                return _strip_html(match.group(1))

        # Last resort: strip all HTML and return if we have enough text
        plain = _strip_html(html)
        if len(plain) > 200:
            return plain

        return None
