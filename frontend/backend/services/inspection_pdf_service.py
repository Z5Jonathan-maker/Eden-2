"""
Inspection PDF Service — Carrier-Ready Photo Report Generation

Supports two export modes:
  - EMAIL_SAFE:     JPEG quality 65, max 1200px, target ≤15 MB, auto-split → ZIP
  - FULL_FIDELITY:  JPEG quality 95, original resolution, archive quality

Provides concurrency protection (one build per claim+mode at a time),
image preparation/compression, deduplication, preflight checks,
page numbers, and structured logging.
"""

import asyncio
import io
import os
import re
import time
import zipfile
from datetime import datetime, timezone
from typing import Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Image as RLImage, Table, TableStyle, PageBreak,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from services.observability import get_logger, MetricsCollector

logger = get_logger("inspection_pdf_service")

# ── constants ────────────────────────────────────────────────────────────────
EMAIL_SAFE_JPEG_QUALITY = 65
EMAIL_SAFE_MAX_DIMENSION = 1200  # px
EMAIL_SAFE_TARGET_SIZE = 15 * 1024 * 1024  # 15 MB

FULL_FIDELITY_JPEG_QUALITY = 95

# ── concurrency locks ────────────────────────────────────────────────────────
_generation_locks: dict[str, asyncio.Lock] = {}


def _get_lock(claim_id: str, mode: str) -> asyncio.Lock:
    key = f"{claim_id}_{mode}"
    if key not in _generation_locks:
        _generation_locks[key] = asyncio.Lock()
    return _generation_locks[key]


# ── image preparation ────────────────────────────────────────────────────────

def prepare_image(file_path: str, mode: str = "email_safe") -> io.BytesIO:
    """
    Open an image, apply EXIF transpose, optionally resize/compress
    based on mode, and return a BytesIO ready for ReportLab.
    Falls back to raw file bytes if PIL is unavailable.
    """
    if not HAS_PIL:
        buf = io.BytesIO()
        with open(file_path, "rb") as f:
            buf.write(f.read())
        buf.seek(0)
        return buf

    img = PILImage.open(file_path)

    # Auto-rotate per EXIF orientation
    try:
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass

    if mode == "email_safe":
        # Resize if larger than max dimension
        w, h = img.size
        if max(w, h) > EMAIL_SAFE_MAX_DIMENSION:
            ratio = EMAIL_SAFE_MAX_DIMENSION / max(w, h)
            new_w, new_h = int(w * ratio), int(h * ratio)
            img = img.resize((new_w, new_h), PILImage.LANCZOS)
        quality = EMAIL_SAFE_JPEG_QUALITY
    else:
        quality = FULL_FIDELITY_JPEG_QUALITY

    buf = io.BytesIO()
    # Convert to RGB if needed (e.g. RGBA PNGs)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    buf.seek(0)
    return buf


# ── deduplication ────────────────────────────────────────────────────────────

def deduplicate_photos(photos: list[dict]) -> list[dict]:
    """Remove duplicate photo entries by ID, first occurrence wins."""
    seen: set[str] = set()
    result: list[dict] = []
    for photo in photos:
        pid = photo.get("id", "")
        if pid and pid not in seen:
            seen.add(pid)
            result.append(photo)
    return result


# ── preflight check ──────────────────────────────────────────────────────────

def preflight_check(
    photos: list[dict],
    photo_dir: str,
    claim_id: str,
    mode: str,
) -> dict:
    """
    Validate photos before PDF generation.
    Returns {"ok": bool, "warnings": [...], "photo_count": int, "missing_files": int}
    """
    warnings: list[str] = []
    missing = 0

    for photo in photos:
        filename = photo.get("filename", "")
        if not filename:
            warnings.append(f"Photo {photo.get('id', '?')} has no filename")
            missing += 1
            continue
        file_path = os.path.join(photo_dir, claim_id, filename)
        if not os.path.exists(file_path):
            missing += 1

    if missing > 0:
        warnings.append(f"{missing} of {len(photos)} photo files not found on disk")

    if len(photos) == 0:
        warnings.append("No photos to include in report")

    return {
        "ok": len(photos) > 0,
        "warnings": warnings,
        "photo_count": len(photos),
        "missing_files": missing,
    }


# ── PDF styles ───────────────────────────────────────────────────────────────

def _build_pdf_styles():
    """Build custom paragraph styles for the photo report PDF."""
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "CoverTitle",
        parent=styles["Title"],
        fontSize=28,
        leading=34,
        textColor=colors.HexColor("#1a1a2e"),
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Heading2"],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#4a4a6a"),
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "CoverMeta",
        parent=styles["Normal"],
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#333333"),
        spaceAfter=2,
    ))
    styles.add(ParagraphStyle(
        "RoomHeader",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=colors.white,
        backColor=colors.HexColor("#1a1a2e"),
        borderPadding=(8, 12, 8, 12),
        spaceBefore=16,
        spaceAfter=10,
    ))
    styles.add(ParagraphStyle(
        "PhotoCaption",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#222222"),
    ))
    styles.add(ParagraphStyle(
        "DamageBadge",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#b91c1c"),
        fontName="Helvetica-Bold",
    ))
    styles.add(ParagraphStyle(
        "GpsText",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#6b7280"),
    ))
    styles.add(ParagraphStyle(
        "VoiceNote",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#4338ca"),
        fontName="Helvetica-Oblique",
    ))
    styles.add(ParagraphStyle(
        "SummaryHeading",
        parent=styles["Heading2"],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor("#1a1a2e"),
        spaceBefore=12,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "TOCEntry",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#1a1a2e"),
    ))
    styles.add(ParagraphStyle(
        "FooterText",
        parent=styles["Normal"],
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#9ca3af"),
        alignment=1,  # center
    ))

    return styles


def _severity_color(severity: str) -> colors.Color:
    """Return a colour matching a severity label."""
    mapping = {
        "critical": colors.HexColor("#991b1b"),
        "high": colors.HexColor("#dc2626"),
        "severe": colors.HexColor("#dc2626"),
        "medium": colors.HexColor("#d97706"),
        "moderate": colors.HexColor("#d97706"),
        "low": colors.HexColor("#16a34a"),
        "minor": colors.HexColor("#16a34a"),
        "none": colors.HexColor("#6b7280"),
    }
    return mapping.get((severity or "").lower(), colors.HexColor("#6b7280"))


# ── page number callback ─────────────────────────────────────────────────────

def _add_page_number(canvas, doc):
    """Draw 'Page N' centered at the bottom of every page."""
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#9ca3af"))
    canvas.drawCentredString(
        letter[0] / 2,
        0.4 * inch,
        f"Page {canvas.getPageNumber()}"
    )
    canvas.restoreState()


# ── story builder ────────────────────────────────────────────────────────────

def build_pdf_story(
    photos_by_room: dict[str, list],
    all_photos: list[dict],
    claim: dict,
    user: dict,
    mode: str,
    photo_dir: str,
    claim_id: str,
    include_ai: bool = True,
    include_gps: bool = True,
    part_info: Optional[str] = None,
) -> list:
    """
    Build the ReportLab 'story' (list of Flowables) for the photo report.
    If part_info is provided (e.g. "Part 1 of 3"), it is shown on the cover.
    """
    styles = _build_pdf_styles()
    story: list = []

    page_width = letter[0] - 1.5 * inch  # usable width

    # ── cover page ───────────────────────────────────────────────────────
    story.append(Spacer(1, 1.2 * inch))

    cover_bar_data = [[""]]
    cover_bar = Table(cover_bar_data, colWidths=[page_width], rowHeights=[4])
    cover_bar.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1a1a2e")),
    ]))
    story.append(cover_bar)
    story.append(Spacer(1, 0.3 * inch))

    story.append(Paragraph("EDEN CLAIMS", styles["CoverTitle"]))
    story.append(Spacer(1, 0.15 * inch))

    subtitle = "Property Inspection Photo Report"
    if part_info:
        subtitle += f" — {part_info}"
    story.append(Paragraph(subtitle, styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.5 * inch))

    # Claim metadata table
    claim_number = claim.get("claim_number") or claim.get("id", "N/A")
    insured_name = claim.get("client_name") or claim.get("insured_name") or "N/A"
    property_address = claim.get("property_address") or claim.get("loss_location") or "N/A"
    inspector_name = user.get("name") or user.get("email") or "N/A"
    report_date = datetime.now().strftime("%B %d, %Y")

    meta_data = [
        ["Claim #:", str(claim_number)],
        ["Insured Name:", str(insured_name)],
        ["Property Address:", str(property_address)],
        ["Report Date:", report_date],
        ["Inspector:", str(inspector_name)],
        ["Total Photos:", str(len(all_photos))],
    ]
    if part_info:
        meta_data.append(["Section:", part_info])

    meta_table = Table(meta_data, colWidths=[1.6 * inch, 4.4 * inch])
    meta_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 11),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#333333")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(meta_table)
    story.append(PageBreak())

    # ── table of contents ────────────────────────────────────────────────
    story.append(Paragraph("Table of Contents", styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.25 * inch))

    toc_rows = [["Room", "Photos"]]
    for room_name in sorted(photos_by_room.keys()):
        toc_rows.append([room_name, str(len(photos_by_room[room_name]))])

    toc_table = Table(toc_rows, colWidths=[4.5 * inch, 1.5 * inch])
    toc_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 11),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ── per-room photo pages ─────────────────────────────────────────────
    max_img_width = 6 * inch
    max_img_height = 4 * inch
    pair_img_width = 2.9 * inch
    pair_img_height = 2.2 * inch

    for room_name in sorted(photos_by_room.keys()):
        room_photos = photos_by_room[room_name]

        # Room header bar
        room_header_data = [[f"  {room_name}   ({len(room_photos)} photo{'s' if len(room_photos) != 1 else ''})"]]
        room_header_table = Table(room_header_data, colWidths=[page_width], rowHeights=[32])
        room_header_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 13),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ]))
        story.append(room_header_table)
        story.append(Spacer(1, 0.15 * inch))

        rendered_ids: set = set()

        for photo in room_photos:
            pid = photo.get("id", "")
            if pid in rendered_ids:
                continue

            # Before/after pair detection
            is_pair = False
            paired_photo = None
            if photo.get("is_before") and photo.get("paired_photo_id"):
                paired_photo = next(
                    (p for p in all_photos if p.get("id") == photo["paired_photo_id"]),
                    None,
                )
                if paired_photo:
                    is_pair = True

            if is_pair and paired_photo:
                # ── side-by-side before / after ──────────────────────
                rendered_ids.add(pid)
                rendered_ids.add(paired_photo.get("id", ""))

                before_path = os.path.join(photo_dir, claim_id, photo.get("filename", ""))
                after_path = os.path.join(photo_dir, claim_id, paired_photo.get("filename", ""))

                pair_cells = []
                for label, p_path, p_data in [("BEFORE", before_path, photo), ("AFTER", after_path, paired_photo)]:
                    cell_items = []
                    lbl_color = "#d97706" if label == "BEFORE" else "#16a34a"
                    cell_items.append(Paragraph(
                        f'<font color="{lbl_color}"><b>{label}</b></font>',
                        styles["PhotoCaption"],
                    ))
                    cell_items.append(Spacer(1, 4))
                    if os.path.exists(p_path):
                        try:
                            img_buf = prepare_image(p_path, mode)
                            img = RLImage(img_buf, width=pair_img_width, height=pair_img_height, kind="proportional")
                            cell_items.append(img)
                        except Exception:
                            cell_items.append(Paragraph("<i>[image unavailable]</i>", styles["PhotoCaption"]))
                    else:
                        cell_items.append(Paragraph("<i>[file not found]</i>", styles["PhotoCaption"]))
                    cell_items.append(Spacer(1, 4))
                    ts = p_data.get("captured_at", "")[:19].replace("T", " ") if p_data.get("captured_at") else ""
                    if ts:
                        cell_items.append(Paragraph(f"Taken: {ts}", styles["GpsText"]))
                    pair_cells.append(cell_items)

                pair_table = Table(
                    [[pair_cells[0], pair_cells[1]]],
                    colWidths=[page_width / 2, page_width / 2],
                )
                pair_table.setStyle(TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ]))
                story.append(pair_table)
                story.append(Spacer(1, 0.2 * inch))

            else:
                # ── standalone photo ─────────────────────────────────
                rendered_ids.add(pid)

                file_path = os.path.join(photo_dir, claim_id, photo.get("filename", ""))
                if os.path.exists(file_path):
                    try:
                        img_buf = prepare_image(file_path, mode)
                        img = RLImage(img_buf, width=max_img_width, height=max_img_height, kind="proportional")
                        story.append(img)
                    except Exception:
                        story.append(Paragraph("<i>[image could not be rendered]</i>", styles["PhotoCaption"]))
                else:
                    story.append(Paragraph("<i>[photo file not found on disk]</i>", styles["PhotoCaption"]))

                story.append(Spacer(1, 4))

                # Caption bar
                caption_rows: list[list] = []

                if include_ai and photo.get("ai_caption"):
                    caption_rows.append([
                        Paragraph("<b>AI Caption:</b>", styles["PhotoCaption"]),
                        Paragraph(str(photo["ai_caption"])[:300], styles["PhotoCaption"]),
                    ])

                if include_ai and photo.get("ai_damage_assessment"):
                    assessment = photo["ai_damage_assessment"]
                    if isinstance(assessment, dict):
                        severity = assessment.get("severity", "N/A")
                        damage_type = assessment.get("damage_type") or assessment.get("type", "N/A")
                        sev_color = _severity_color(severity)
                        badge_text = (
                            f'<font color="{sev_color.hexval()}">[{severity.upper()}]</font> {damage_type}'
                        )
                        caption_rows.append([
                            Paragraph("<b>Damage:</b>", styles["PhotoCaption"]),
                            Paragraph(badge_text, styles["DamageBadge"]),
                        ])
                    elif isinstance(assessment, str):
                        caption_rows.append([
                            Paragraph("<b>Damage:</b>", styles["PhotoCaption"]),
                            Paragraph(str(assessment)[:300], styles["DamageBadge"]),
                        ])

                if include_gps and photo.get("latitude") and photo.get("longitude"):
                    caption_rows.append([
                        Paragraph("<b>GPS:</b>", styles["GpsText"]),
                        Paragraph(
                            f'{photo["latitude"]:.6f}, {photo["longitude"]:.6f}',
                            styles["GpsText"],
                        ),
                    ])

                ts = photo.get("captured_at", "")[:19].replace("T", " ") if photo.get("captured_at") else ""
                if ts:
                    caption_rows.append([
                        Paragraph("<b>Taken:</b>", styles["PhotoCaption"]),
                        Paragraph(ts, styles["PhotoCaption"]),
                    ])

                if photo.get("voice_snippet"):
                    snippet = str(photo["voice_snippet"])[:200]
                    if len(str(photo["voice_snippet"])) > 200:
                        snippet += "..."
                    caption_rows.append([
                        Paragraph("<b>Voice:</b>", styles["VoiceNote"]),
                        Paragraph(f'"{snippet}"', styles["VoiceNote"]),
                    ])

                if caption_rows:
                    cap_table = Table(caption_rows, colWidths=[1.0 * inch, page_width - 1.0 * inch])
                    cap_table.setStyle(TableStyle([
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f9fafb")),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]))
                    story.append(cap_table)

                story.append(Spacer(1, 0.25 * inch))

        # Page break after each room section
        story.append(PageBreak())

    # ── summary page ─────────────────────────────────────────────────────
    story.append(Paragraph("Summary", styles["SummaryHeading"]))
    story.append(Spacer(1, 0.15 * inch))

    damage_rows = [["Room", "Damage Type", "Severity", "Description", "Urgency"]]
    severity_values: list[float] = []
    severity_map = {"critical": 5, "high": 4, "severe": 4, "medium": 3, "moderate": 3, "low": 2, "minor": 1, "none": 0}

    for photo in all_photos:
        assessment = photo.get("ai_damage_assessment")
        if not assessment or not isinstance(assessment, dict):
            continue
        r_name = photo.get("room") or "Uncategorized"
        severity = assessment.get("severity", "N/A")
        damage_type = assessment.get("damage_type") or assessment.get("type", "N/A")
        description = assessment.get("description", "")[:80]
        urgency = assessment.get("urgency", "N/A")
        damage_rows.append([r_name, str(damage_type), str(severity), str(description), str(urgency)])
        sev_num = severity_map.get((severity or "").lower())
        if sev_num is not None:
            severity_values.append(sev_num)

    if len(damage_rows) > 1:
        story.append(Paragraph("AI Damage Summary", styles["CoverSubtitle"]))
        story.append(Spacer(1, 0.1 * inch))

        dmg_table = Table(
            damage_rows,
            colWidths=[1.2 * inch, 1.2 * inch, 0.9 * inch, 2.2 * inch, 0.9 * inch],
            repeatRows=1,
        )
        dmg_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(dmg_table)
        story.append(Spacer(1, 0.3 * inch))

    # Overall statistics
    story.append(Paragraph("Overall Statistics", styles["CoverSubtitle"]))
    story.append(Spacer(1, 0.1 * inch))

    avg_severity = round(sum(severity_values) / len(severity_values), 2) if severity_values else "N/A"
    avg_label = ""
    if isinstance(avg_severity, (int, float)):
        if avg_severity >= 4:
            avg_label = " (High / Severe)"
        elif avg_severity >= 3:
            avg_label = " (Moderate)"
        elif avg_severity >= 2:
            avg_label = " (Low)"
        else:
            avg_label = " (Minor)"

    claim_number = claim.get("claim_number") or claim.get("id", "N/A")

    stats_data = [
        ["Total Photos", str(len(all_photos))],
        ["Rooms Documented", str(len(photos_by_room))],
        ["Average Severity Score", f"{avg_severity}{avg_label}"],
        ["Report Generated", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")],
    ]
    stats_table = Table(stats_data, colWidths=[2.5 * inch, 3.5 * inch])
    stats_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1a1a2e")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(stats_table)
    story.append(Spacer(1, 0.5 * inch))

    # Footer note
    story.append(Paragraph(
        f"Generated by Eden Claims on {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')} "
        f"| Claim {claim_number} | {len(all_photos)} photos",
        styles["FooterText"],
    ))

    return story


# ── single PDF builder ───────────────────────────────────────────────────────

def build_single_pdf(story: list) -> io.BytesIO:
    """Render a story into a PDF buffer with page numbers."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )
    doc.build(story, onFirstPage=_add_page_number, onLaterPages=_add_page_number)
    buf.seek(0)
    return buf


# ── email-safe output (auto-split → ZIP if > 15 MB) ─────────────────────────

def generate_email_safe_output(
    photos_by_room: dict[str, list],
    all_photos: list[dict],
    claim: dict,
    user: dict,
    photo_dir: str,
    claim_id: str,
    include_ai: bool = True,
    include_gps: bool = True,
) -> tuple[io.BytesIO, str]:
    """
    Build an email-safe PDF. If the result exceeds EMAIL_SAFE_TARGET_SIZE,
    auto-split by room groups into a ZIP of smaller PDFs.

    Returns (buffer, content_type) where content_type is
    "application/pdf" or "application/zip".
    """
    # Try single PDF first
    story = build_pdf_story(
        photos_by_room, all_photos, claim, user,
        mode="email_safe", photo_dir=photo_dir, claim_id=claim_id,
        include_ai=include_ai, include_gps=include_gps,
    )
    pdf_buf = build_single_pdf(story)
    pdf_size = pdf_buf.getbuffer().nbytes

    if pdf_size <= EMAIL_SAFE_TARGET_SIZE:
        return pdf_buf, "application/pdf"

    # Auto-split: group rooms into parts that fit under the target
    logger.info(
        "PDF exceeds email-safe limit, splitting",
        claim_id=claim_id, pdf_size_mb=round(pdf_size / (1024 * 1024), 2),
    )

    sorted_rooms = sorted(photos_by_room.keys())
    parts: list[list[str]] = []
    current_part: list[str] = []

    # Estimate ~150KB per photo in email-safe mode as heuristic
    bytes_per_photo_estimate = 150 * 1024
    current_estimate = 0

    for room in sorted_rooms:
        room_photo_count = len(photos_by_room[room])
        room_estimate = room_photo_count * bytes_per_photo_estimate

        if current_part and (current_estimate + room_estimate) > EMAIL_SAFE_TARGET_SIZE * 0.85:
            parts.append(current_part)
            current_part = []
            current_estimate = 0

        current_part.append(room)
        current_estimate += room_estimate

    if current_part:
        parts.append(current_part)

    # Build each part
    zip_buf = io.BytesIO()
    claim_number = claim.get("claim_number") or claim.get("id", "unknown")
    safe_claim = re.sub(r"[^a-zA-Z0-9_-]", "_", str(claim_number))

    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, room_list in enumerate(parts, 1):
            part_rooms = {r: photos_by_room[r] for r in room_list}
            part_photos = [p for r in room_list for p in photos_by_room[r]]
            part_info = f"Part {i} of {len(parts)}"

            part_story = build_pdf_story(
                part_rooms, part_photos, claim, user,
                mode="email_safe", photo_dir=photo_dir, claim_id=claim_id,
                include_ai=include_ai, include_gps=include_gps,
                part_info=part_info,
            )
            part_pdf = build_single_pdf(part_story)
            zf.writestr(
                f"photo_report_{safe_claim}_part{i}.pdf",
                part_pdf.getvalue(),
            )

    zip_buf.seek(0)
    return zip_buf, "application/zip"


# ── orchestrator ─────────────────────────────────────────────────────────────

async def generate_photo_report(
    claim_id: str,
    mode: str,
    user: dict,
    db,
    photo_dir: str,
    include_ai: bool = True,
    include_gps: bool = True,
    rooms: Optional[str] = None,
) -> tuple[io.BytesIO, str, str]:
    """
    Main orchestrator. Fetches data, deduplicates, runs preflight,
    acquires a concurrency lock, and dispatches to the correct mode.

    Returns (buffer, content_type, filename).
    """
    t0 = time.time()

    # ── fetch data ───────────────────────────────────────────────────────
    photo_query: dict = {"claim_id": claim_id}
    room_filter_list: list | None = None
    if rooms:
        room_filter_list = [r.strip() for r in rooms.split(",") if r.strip()]
        if room_filter_list:
            photo_query["room"] = {"$in": room_filter_list}

    all_photos = await db.inspection_photos.find(
        photo_query, {"_id": 0}
    ).sort("captured_at", 1).to_list(None)

    claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise ValueError("Claim not found")

    if not all_photos:
        raise ValueError("No photos found for this claim")

    # ── deduplicate ──────────────────────────────────────────────────────
    all_photos = deduplicate_photos(all_photos)

    # ── preflight ────────────────────────────────────────────────────────
    check = preflight_check(all_photos, photo_dir, claim_id, mode)
    if not check["ok"]:
        raise ValueError(f"Preflight failed: {'; '.join(check['warnings'])}")
    if check["warnings"]:
        for w in check["warnings"]:
            logger.warning("PDF preflight warning", claim_id=claim_id, warning=w)

    # ── organise by room ─────────────────────────────────────────────────
    by_room: dict[str, list] = {}
    for photo in all_photos:
        room_name = photo.get("room") or "Uncategorized"
        by_room.setdefault(room_name, []).append(photo)

    # ── acquire lock & build ─────────────────────────────────────────────
    lock = _get_lock(claim_id, mode)
    async with lock:
        if mode == "email_safe":
            buf, content_type = generate_email_safe_output(
                by_room, all_photos, claim, user,
                photo_dir=photo_dir, claim_id=claim_id,
                include_ai=include_ai, include_gps=include_gps,
            )
        else:
            # Full fidelity — single PDF, no compression
            story = build_pdf_story(
                by_room, all_photos, claim, user,
                mode="full_fidelity", photo_dir=photo_dir, claim_id=claim_id,
                include_ai=include_ai, include_gps=include_gps,
            )
            buf = build_single_pdf(story)
            content_type = "application/pdf"

    # ── filename ─────────────────────────────────────────────────────────
    claim_number = claim.get("claim_number") or claim.get("id", "N/A")
    safe_claim = re.sub(r"[^a-zA-Z0-9_-]", "_", str(claim_number))
    date_str = datetime.now().strftime("%Y%m%d")

    if content_type == "application/zip":
        filename = f"photo_report_{safe_claim}_{date_str}.zip"
    else:
        filename = f"photo_report_{safe_claim}_{date_str}.pdf"

    # ── metrics ──────────────────────────────────────────────────────────
    duration_ms = round((time.time() - t0) * 1000, 1)
    output_size = buf.getbuffer().nbytes
    MetricsCollector.increment("pdf_generation_total", {"mode": mode})
    MetricsCollector.record_timing("pdf_generation_ms", duration_ms, {"mode": mode})
    logger.info(
        "PDF generation complete",
        claim_id=claim_id,
        mode=mode,
        photo_count=len(all_photos),
        rooms=len(by_room),
        output_size_mb=round(output_size / (1024 * 1024), 2),
        duration_ms=duration_ms,
        content_type=content_type,
    )

    return buf, content_type, filename
