"""
Google Drive Mirror Backup Service

Silently duplicates Eden's primary file storage into a parallel,
human-readable folder tree in Google Drive.

Folder structure:
  Eden Backup/
    Claims/
      {LastName} – {Address} – {DateOfLoss}/
        Estimates/
        Photos/
        Correspondence/
        Reports/
        Legal/
        General/
    Library/
      {BookTitle}/
    Templates/

Design principles:
  - Mirror-only: Drive is the secondary copy, never the source of truth
  - Idempotent: re-uploading the same file is a no-op
  - Event-driven: mirrors on file save, with daily reconciliation
  - Graceful degradation: failures are logged, never block the primary flow
"""

import os
import logging
import io
from typing import Optional, Dict, Any
from datetime import datetime, timezone

import httpx

from dependencies import db

logger = logging.getLogger(__name__)

# Config
DRIVE_API = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"
MIRROR_ROOT_NAME = "Eden Backup"
MIRROR_ENABLED = os.environ.get("DRIVE_MIRROR_ENABLED", "false").lower() == "true"

# Subcategory folders per claim
CLAIM_SUBCATEGORIES = [
    "Estimates",
    "Photos",
    "Correspondence",
    "Reports",
    "Legal",
    "General",
]

# Map file types / contexts to subcategories
FILE_CATEGORY_MAP = {
    "estimate": "Estimates",
    "carrier_estimate": "Estimates",
    "contractor_estimate": "Estimates",
    "photo": "Photos",
    "image": "Photos",
    "inspection": "Photos",
    "email": "Correspondence",
    "letter": "Correspondence",
    "correspondence": "Correspondence",
    "report": "Reports",
    "inspection_report": "Reports",
    "brief": "Reports",
    "legal": "Legal",
    "demand": "Legal",
    "contract": "Legal",
}


class DriveMirrorService:
    """Mirrors files to Google Drive using OAuth user tokens."""

    def __init__(self):
        self._folder_cache: Dict[str, str] = {}

    async def _get_token(self, user_id: str) -> Optional[str]:
        """Get a valid Google OAuth token for the user."""
        try:
            from routes.oauth import get_valid_token
            return await get_valid_token(user_id, "google")
        except Exception as e:
            logger.debug(f"Drive mirror: no Google token for user {user_id}: {e}")
            return None

    async def _get_service_token(self) -> Optional[str]:
        """Get a token from the first available Google-connected user (for background jobs)."""
        token_doc = await db.oauth_tokens.find_one(
            {"provider": "google", "access_token": {"$exists": True}},
            sort=[("updated_at", -1)],
        )
        if not token_doc:
            return None
        user_id = token_doc.get("user_id")
        return await self._get_token(user_id)

    async def _drive_request(
        self, token: str, method: str, url: str, **kwargs
    ) -> Optional[httpx.Response]:
        """Make an authenticated Drive API request with retry on 401."""
        headers = kwargs.pop("headers", {})
        headers["Authorization"] = f"Bearer {token}"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.request(method, url, headers=headers, **kwargs)
            if resp.status_code == 401:
                logger.warning("Drive mirror: token expired during request")
                return None
            return resp

    # ── Folder management ──────────────────────────────────────

    async def _find_folder(
        self, token: str, name: str, parent_id: Optional[str] = None
    ) -> Optional[str]:
        """Find a folder by name under an optional parent. Returns folder ID or None."""
        cache_key = f"{parent_id or 'root'}:{name}"
        if cache_key in self._folder_cache:
            return self._folder_cache[cache_key]

        q = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_id:
            q += f" and '{parent_id}' in parents"

        resp = await self._drive_request(
            token, "GET", f"{DRIVE_API}/files",
            params={"q": q, "fields": "files(id,name)", "pageSize": 1},
        )
        if not resp or resp.status_code != 200:
            return None

        files = resp.json().get("files", [])
        if files:
            fid = files[0]["id"]
            self._folder_cache[cache_key] = fid
            return fid
        return None

    async def _create_folder(
        self, token: str, name: str, parent_id: Optional[str] = None
    ) -> Optional[str]:
        """Create a folder in Drive. Returns folder ID."""
        metadata: Dict[str, Any] = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
        }
        if parent_id:
            metadata["parents"] = [parent_id]

        resp = await self._drive_request(
            token, "POST", f"{DRIVE_API}/files",
            json=metadata,
            params={"fields": "id"},
        )
        if not resp or resp.status_code not in (200, 201):
            logger.error(f"Drive mirror: failed to create folder '{name}': {resp and resp.text}")
            return None

        fid = resp.json().get("id")
        cache_key = f"{parent_id or 'root'}:{name}"
        self._folder_cache[cache_key] = fid
        return fid

    async def _ensure_folder(
        self, token: str, name: str, parent_id: Optional[str] = None
    ) -> Optional[str]:
        """Find or create a folder. Returns folder ID."""
        fid = await self._find_folder(token, name, parent_id)
        if fid:
            return fid
        return await self._create_folder(token, name, parent_id)

    async def _ensure_folder_path(
        self, token: str, path: list[str]
    ) -> Optional[str]:
        """Ensure a nested folder path exists, e.g. ['Eden Backup', 'Claims', 'Smith...']."""
        parent_id = None
        for folder_name in path:
            parent_id = await self._ensure_folder(token, folder_name, parent_id)
            if not parent_id:
                return None
        return parent_id

    # ── Claim folder naming ────────────────────────────────────

    @staticmethod
    def _claim_folder_name(claim: dict) -> str:
        """Build the folder name: LastName – Address – DateOfLoss"""
        name = claim.get("client_name", "Unknown")
        # Extract last name
        parts = name.strip().split()
        last_name = parts[-1] if parts else "Unknown"

        address = claim.get("property_address", "No Address")
        # Shorten address (take street portion)
        addr_parts = address.split(",")
        short_addr = addr_parts[0].strip() if addr_parts else address

        dol = claim.get("date_of_loss", "")
        if dol:
            # Try to format as YYYY-MM-DD
            dol_short = dol[:10]
        else:
            dol_short = "No-Date"

        # Clean up for Drive folder name (no special chars)
        folder = f"{last_name} – {short_addr} – {dol_short}"
        # Remove chars that Drive doesn't like
        for ch in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
            folder = folder.replace(ch, '-')
        return folder

    # ── File upload ────────────────────────────────────────────

    async def _upload_file(
        self,
        token: str,
        file_name: str,
        file_bytes: bytes,
        mime_type: str,
        folder_id: str,
    ) -> Optional[str]:
        """Upload a file to Drive. Returns file ID."""
        # Check if file already exists in the folder (idempotent)
        existing = await self._find_existing_file(token, file_name, folder_id)
        if existing:
            logger.debug(f"Drive mirror: file '{file_name}' already exists, skipping")
            return existing

        metadata = {
            "name": file_name,
            "parents": [folder_id],
        }

        # Use multipart upload
        import json
        boundary = "===EDEN_MIRROR_BOUNDARY==="
        body = (
            f"--{boundary}\r\n"
            f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
            f"{json.dumps(metadata)}\r\n"
            f"--{boundary}\r\n"
            f"Content-Type: {mime_type}\r\n\r\n"
        ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--".encode("utf-8")

        resp = await self._drive_request(
            token, "POST",
            f"{DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id",
            content=body,
            headers={"Content-Type": f"multipart/related; boundary={boundary}"},
        )
        if not resp or resp.status_code not in (200, 201):
            logger.error(f"Drive mirror: upload failed for '{file_name}': {resp and resp.text[:300]}")
            return None

        file_id = resp.json().get("id")
        logger.info(f"Drive mirror: uploaded '{file_name}' → {file_id}")
        return file_id

    async def _find_existing_file(
        self, token: str, name: str, folder_id: str
    ) -> Optional[str]:
        """Check if a file with this name exists in the folder."""
        q = f"name='{name}' and '{folder_id}' in parents and trashed=false"
        resp = await self._drive_request(
            token, "GET", f"{DRIVE_API}/files",
            params={"q": q, "fields": "files(id)", "pageSize": 1},
        )
        if not resp or resp.status_code != 200:
            return None
        files = resp.json().get("files", [])
        return files[0]["id"] if files else None

    # ── Public API ─────────────────────────────────────────────

    async def mirror_claim_file(
        self,
        user_id: str,
        claim_id: str,
        file_name: str,
        file_bytes: bytes,
        mime_type: str,
        category: str = "general",
    ) -> Optional[str]:
        """
        Mirror a file to the claim's Drive folder.

        Args:
            user_id: User who owns the Google OAuth token
            claim_id: Claim ID to look up claim details
            file_name: Original filename
            file_bytes: File content
            mime_type: MIME type
            category: File category (estimate, photo, report, etc.)

        Returns:
            Drive file ID if successful, None otherwise
        """
        if not MIRROR_ENABLED:
            return None

        try:
            token = await self._get_token(user_id)
            if not token:
                await self._log_dead_letter(
                    claim_id, file_name, "no_google_token",
                    f"User {user_id} has no Google OAuth token",
                )
                return None

            # Get claim details for folder naming
            claim = await db.claims.find_one({"id": claim_id}, {"_id": 0})
            if not claim:
                await self._log_dead_letter(claim_id, file_name, "claim_not_found")
                return None

            # Build folder path
            claim_folder = self._claim_folder_name(claim)
            subcategory = FILE_CATEGORY_MAP.get(category.lower(), "General")
            folder_path = [MIRROR_ROOT_NAME, "Claims", claim_folder, subcategory]

            folder_id = await self._ensure_folder_path(token, folder_path)
            if not folder_id:
                await self._log_dead_letter(
                    claim_id, file_name, "folder_creation_failed",
                    f"Could not create folder path: {'/'.join(folder_path)}",
                )
                return None

            # Upload file
            drive_file_id = await self._upload_file(
                token, file_name, file_bytes, mime_type, folder_id,
            )

            if drive_file_id:
                # Record the mapping
                await self._record_mapping(
                    claim_id=claim_id,
                    file_name=file_name,
                    drive_file_id=drive_file_id,
                    category=subcategory,
                    user_id=user_id,
                )

            return drive_file_id

        except Exception as e:
            logger.error(f"Drive mirror error for claim {claim_id}/{file_name}: {e}")
            await self._log_dead_letter(claim_id, file_name, "exception", str(e))
            return None

    async def mirror_library_file(
        self,
        user_id: str,
        book_title: str,
        file_name: str,
        file_bytes: bytes,
        mime_type: str,
    ) -> Optional[str]:
        """Mirror a library book to Drive."""
        if not MIRROR_ENABLED:
            return None

        try:
            token = await self._get_token(user_id)
            if not token:
                return None

            folder_path = [MIRROR_ROOT_NAME, "Library"]
            folder_id = await self._ensure_folder_path(token, folder_path)
            if not folder_id:
                return None

            return await self._upload_file(
                token, file_name, file_bytes, mime_type, folder_id,
            )
        except Exception as e:
            logger.error(f"Drive mirror error for library/{file_name}: {e}")
            return None

    # ── Mapping & Dead Letter ──────────────────────────────────

    async def _record_mapping(
        self,
        claim_id: str,
        file_name: str,
        drive_file_id: str,
        category: str,
        user_id: str,
    ):
        """Record the mapping from Eden file to Drive file."""
        await db.drive_mirror_map.update_one(
            {"claim_id": claim_id, "file_name": file_name},
            {"$set": {
                "drive_file_id": drive_file_id,
                "category": category,
                "user_id": user_id,
                "mirrored_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )

    async def _log_dead_letter(
        self,
        claim_id: str,
        file_name: str,
        error_type: str,
        detail: str = "",
    ):
        """Log a failed mirror attempt for later retry."""
        await db.drive_mirror_dead_letter.insert_one({
            "claim_id": claim_id,
            "file_name": file_name,
            "error_type": error_type,
            "detail": detail,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "retried": False,
        })
        logger.warning(
            f"Drive mirror dead letter: {error_type} for {claim_id}/{file_name}: {detail}"
        )

    # ── Reconciliation ─────────────────────────────────────────

    async def reconcile(self) -> Dict[str, int]:
        """
        Daily reconciliation: check all uploaded files against the mirror map.
        Re-mirror anything that's missing.

        Returns stats: { checked, already_mirrored, newly_mirrored, failed }
        """
        if not MIRROR_ENABLED:
            return {"checked": 0, "skipped": True}

        token = await self._get_service_token()
        if not token:
            logger.warning("Drive mirror reconciliation: no Google token available")
            return {"checked": 0, "error": "no_token"}

        stats = {"checked": 0, "already_mirrored": 0, "newly_mirrored": 0, "failed": 0}

        # Get all uploaded files
        cursor = db.uploaded_files.find(
            {"storage": "gridfs"},
            {"_id": 0, "file_id": 1, "original_name": 1, "mime_type": 1,
             "content_id": 1, "content_type": 1, "grid_id": 1},
        )

        async for file_doc in cursor:
            stats["checked"] += 1
            file_id = file_doc.get("file_id")
            file_name = file_doc.get("original_name", file_id)

            # Check if already mirrored
            existing = await db.drive_mirror_map.find_one({"file_name": file_name})
            if existing:
                stats["already_mirrored"] += 1
                continue

            # Try to determine claim context
            content_id = file_doc.get("content_id")
            content_type = file_doc.get("content_type", "general")

            if not content_id:
                continue  # Can't determine claim, skip

            # Check if content_id is a claim
            claim = await db.claims.find_one({"id": content_id}, {"_id": 0})
            if not claim:
                continue

            # Fetch file bytes from GridFS
            try:
                grid_id = file_doc.get("grid_id")
                if not grid_id:
                    continue

                from motor.motor_asyncio import AsyncIOMotorGridFSBucket
                from bson import ObjectId

                fs = AsyncIOMotorGridFSBucket(db.delegate)
                grid_out = await fs.open_download_stream(ObjectId(grid_id))
                file_bytes = await grid_out.read()

                if not file_bytes:
                    continue

                # Determine category
                category = FILE_CATEGORY_MAP.get(content_type.lower(), "General")
                claim_folder = self._claim_folder_name(claim)
                folder_path = [MIRROR_ROOT_NAME, "Claims", claim_folder, category]

                folder_id = await self._ensure_folder_path(token, folder_path)
                if not folder_id:
                    stats["failed"] += 1
                    continue

                drive_file_id = await self._upload_file(
                    token, file_name, file_bytes,
                    file_doc.get("mime_type", "application/octet-stream"),
                    folder_id,
                )

                if drive_file_id:
                    await self._record_mapping(
                        claim_id=content_id,
                        file_name=file_name,
                        drive_file_id=drive_file_id,
                        category=category,
                        user_id="reconciliation",
                    )
                    stats["newly_mirrored"] += 1
                else:
                    stats["failed"] += 1

            except Exception as e:
                logger.error(f"Reconciliation error for {file_name}: {e}")
                stats["failed"] += 1

        logger.info(f"Drive mirror reconciliation: {stats}")
        return stats

    async def retry_dead_letters(self, limit: int = 50) -> Dict[str, int]:
        """Retry failed mirror attempts from the dead letter queue."""
        if not MIRROR_ENABLED:
            return {"retried": 0}

        stats = {"retried": 0, "succeeded": 0, "still_failed": 0}
        cursor = db.drive_mirror_dead_letter.find(
            {"retried": False},
        ).sort("created_at", 1).limit(limit)

        async for letter in cursor:
            stats["retried"] += 1
            # Mark as retried regardless of outcome
            await db.drive_mirror_dead_letter.update_one(
                {"_id": letter["_id"]},
                {"$set": {"retried": True, "retried_at": datetime.now(timezone.utc).isoformat()}},
            )
            # We can't easily retry without the file bytes,
            # so we rely on reconciliation to catch these.
            stats["still_failed"] += 1

        return stats


# Singleton
_mirror_service = None


def get_drive_mirror() -> DriveMirrorService:
    """Get the Drive mirror service singleton."""
    global _mirror_service
    if _mirror_service is None:
        _mirror_service = DriveMirrorService()
    return _mirror_service
