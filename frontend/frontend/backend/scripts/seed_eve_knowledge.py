"""
Seed Eve's knowledge base into MongoDB (eve_knowledge_base collection).

Loads the full expert knowledge documents from docs/ and memory/ directories,
splits them into categorized chunks, and stores them in MongoDB with metadata
for semantic search.

Usage:
    python scripts/seed_eve_knowledge.py

Environment:
    MONGODB_URI — MongoDB connection string (required)
    MONGODB_DB  — Database name (default: eden2)
"""

import asyncio
import hashlib
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

DOCS_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "docs"
MEMORY_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "memory"

# Map of source files to their category and description
KNOWLEDGE_SOURCES = [
    {
        "file": DOCS_DIR / "eve-expert-knowledge.md",
        "category": "claims_handling",
        "source": "Zalma, United Policyholders, FAPIA, FL Statutes",
        "description": "Claims handling best practices, bad faith indicators, fraud detection, FL statutes (626/627), policyholder advocacy",
    },
    {
        "file": DOCS_DIR / "eve-merlin-knowledge.md",
        "category": "case_law_and_tactics",
        "source": "Chip Merlin / Property Insurance Coverage Law Blog",
        "description": "Bad faith case law, carrier misconduct patterns, policy interpretation, appraisal strategy, FL statute analysis",
    },
    {
        "file": DOCS_DIR / "eve-pa-playbook.md",
        "category": "pa_playbook",
        "source": "Care Claims PA Playbook",
        "description": "Negotiation frameworks, supplement writing, appraisal criteria, carrier counter-tactics, Xactimate disputes, post-SB 2A strategy",
    },
    {
        "file": DOCS_DIR / "fl-insurance-law-reference.md",
        "category": "florida_law",
        "source": "Florida Statutes, Case Law, Legislative Analysis",
        "description": "Deadlines, PA rights, carrier duties, dispute resolution, bad faith, SB 2A impact, 2025-2026 legislation, administrative rules",
    },
    {
        "file": DOCS_DIR / "eve-institutional-knowledge.md",
        "category": "institutional",
        "source": "FAPIA, NAPIA, United Policyholders, FL DFS, Merlin Law",
        "description": "Regulatory framework, licensing, ethics, legislation 2022-2025, carrier misconduct patterns, mediation/appraisal processes",
    },
    {
        "file": DOCS_DIR / "eve-technical-knowledge.md",
        "category": "technical",
        "source": "FL Building Code, IICRC, ISO, Industry Data",
        "description": "FL Building Code (25% rule), wind mitigation, IICRC S500/S520/S700, policy forms (HO-3/HO-6/DP-3), depreciation, Xactimate pricing",
    },
    {
        "file": MEMORY_DIR / "EVE_PA_INDUSTRY_KNOWLEDGE.md",
        "category": "industry_knowledge",
        "source": "PA Industry Leaders (Senac, Gurczak, Perri, Quinn, Tutwiler, Goodman, Voelpel)",
        "description": "Industry leader methodologies, appraisal process expertise, Xactimate best practices, negotiation tactics, supplement strategy",
    },
]


def _split_into_sections(content: str) -> list[dict]:
    """Split markdown content into sections based on ## headers."""
    sections = []
    current_title = "Introduction"
    current_content_lines: list[str] = []

    for line in content.split("\n"):
        # Check for ## or ### headers
        header_match = re.match(r"^(#{1,3})\s+(.+)", line)
        if header_match and len(header_match.group(1)) <= 2:
            # Save previous section if it has content
            section_text = "\n".join(current_content_lines).strip()
            if section_text and len(section_text) > 50:
                sections.append({
                    "title": current_title,
                    "content": section_text,
                })
            current_title = header_match.group(2).strip()
            current_content_lines = []
        else:
            current_content_lines.append(line)

    # Don't forget the last section
    section_text = "\n".join(current_content_lines).strip()
    if section_text and len(section_text) > 50:
        sections.append({
            "title": current_title,
            "content": section_text,
        })

    return sections


def _content_hash(content: str) -> str:
    """Generate a stable hash for deduplication."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def _extract_keywords(content: str) -> list[str]:
    """Extract searchable keywords from content."""
    keyword_patterns = [
        r"F\.S\.\s+[\d.]+",      # Florida statute references
        r"\d{3}\.\d+",            # Statute numbers
        r"SB\s+\d+",             # Senate bills
        r"HB\s+\d+",             # House bills
        r"S\d{3}",               # IICRC standards
        r"HO-\d",                # Policy forms
        r"DP-\d",                # Policy forms
    ]

    keywords = set()
    content_lower = content.lower()

    # Extract pattern-based keywords
    for pattern in keyword_patterns:
        for match in re.finditer(pattern, content, re.IGNORECASE):
            keywords.add(match.group(0).strip())

    # Extract topic keywords
    topic_terms = [
        "bad faith", "appraisal", "mediation", "supplement", "xactimate",
        "depreciation", "rcv", "acv", "o&p", "overhead", "matching",
        "wind mitigation", "roof", "water damage", "mold", "fire",
        "hurricane", "flood", "carrier", "citizens", "universal",
        "heritage", "tower hill", "security first", "slide",
        "civil remedy", "crn", "euo", "rescission", "cancellation",
        "fee cap", "contract", "licensing", "bond", "apprentice",
        "code upgrade", "building code", "25% rule", "iicrc",
        "sb 2a", "hb 837", "tort reform", "aob", "attorney fees",
        "delay", "deny", "underpay", "lowball", "scope reduction",
        "constructive total loss", "valued policy law",
        "wind-driven rain", "causation", "exclusion",
    ]

    for term in topic_terms:
        if term in content_lower:
            keywords.add(term)

    return sorted(keywords)


async def seed_knowledge_base():
    """Load all knowledge documents into MongoDB."""
    # Import motor for async MongoDB
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
    except ImportError:
        print("ERROR: motor package not installed. Run: pip install motor")
        sys.exit(1)

    mongo_uri = os.environ.get("MONGODB_URI")
    if not mongo_uri:
        print("ERROR: MONGODB_URI environment variable not set.")
        print("Set it to your MongoDB connection string.")
        sys.exit(1)

    db_name = os.environ.get("MONGODB_DB", "eden2")
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    collection = db["eve_knowledge_base"]

    print(f"Connected to MongoDB: {db_name}")
    print(f"Collection: eve_knowledge_base")
    print(f"Documents directory: {DOCS_DIR}")
    print(f"Memory directory: {MEMORY_DIR}")
    print()

    total_docs = 0
    total_sections = 0

    for source_info in KNOWLEDGE_SOURCES:
        filepath = source_info["file"]
        if not filepath.exists():
            print(f"  SKIP: {filepath.name} — file not found")
            continue

        content = filepath.read_text(encoding="utf-8")
        file_size_kb = len(content) / 1024

        sections = _split_into_sections(content)
        print(f"  {filepath.name} ({file_size_kb:.1f} KB) -> {len(sections)} sections")

        for section in sections:
            doc_hash = _content_hash(section["content"])

            # Check for existing document with same hash (idempotent)
            existing = await collection.find_one({"content_hash": doc_hash})
            if existing:
                continue

            keywords = _extract_keywords(section["content"])

            doc = {
                "title": section["title"],
                "content": section["content"],
                "content_hash": doc_hash,
                "category": source_info["category"],
                "source": source_info["source"],
                "source_file": filepath.name,
                "description": source_info["description"],
                "keywords": keywords,
                "word_count": len(section["content"].split()),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            await collection.insert_one(doc)
            total_sections += 1

        total_docs += 1

    # Create text index for search
    existing_indexes = await collection.index_information()
    if "knowledge_text_search" not in existing_indexes:
        await collection.create_index(
            [("title", "text"), ("content", "text"), ("keywords", "text")],
            name="knowledge_text_search",
            weights={"title": 10, "keywords": 5, "content": 1},
        )
        print("\n  Created text search index: knowledge_text_search")

    # Create category index
    if "category_1" not in existing_indexes:
        await collection.create_index("category", name="category_1")
        print("  Created category index")

    # Create content_hash index for deduplication
    if "content_hash_1" not in existing_indexes:
        await collection.create_index("content_hash", unique=True, name="content_hash_1")
        print("  Created content_hash unique index")

    total_in_db = await collection.count_documents({})
    print(f"\nDone. Processed {total_docs} files, inserted {total_sections} new sections.")
    print(f"Total documents in eve_knowledge_base: {total_in_db}")

    client.close()


if __name__ == "__main__":
    asyncio.run(seed_knowledge_base())
