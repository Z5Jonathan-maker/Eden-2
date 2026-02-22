"""Object storage abstraction for evidence binaries and extracted text."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import boto3
from botocore.client import Config


@dataclass
class StorageSettings:
    bucket: str
    region: str
    endpoint_url: Optional[str]
    prefix: str
    signed_url_ttl_seconds: int


class ObjectStorageService:
    def __init__(self):
        bucket = os.getenv("EVIDENCE_STORAGE_BUCKET", "").strip()
        region = os.getenv("EVIDENCE_STORAGE_REGION", "us-east-1").strip() or "us-east-1"
        endpoint = os.getenv("EVIDENCE_STORAGE_ENDPOINT", "").strip() or None
        prefix = os.getenv("EVIDENCE_STORAGE_PREFIX", "evidence").strip().strip("/")
        ttl_raw = os.getenv("EVIDENCE_STORAGE_SIGNED_URL_TTL", "3600").strip()
        try:
            ttl = max(60, min(86400, int(ttl_raw)))
        except Exception:
            ttl = 3600

        self.settings = StorageSettings(
            bucket=bucket,
            region=region,
            endpoint_url=endpoint,
            prefix=prefix,
            signed_url_ttl_seconds=ttl,
        )

        session = boto3.session.Session()
        self.client = session.client(
            "s3",
            region_name=self.settings.region,
            endpoint_url=self.settings.endpoint_url,
            config=Config(signature_version="s3v4"),
        )

    @property
    def configured(self) -> bool:
        return bool(self.settings.bucket)

    def _object_key(self, key: str) -> str:
        clean_key = key.strip().lstrip("/")
        if not self.settings.prefix:
            return clean_key
        return f"{self.settings.prefix}/{clean_key}"

    def _assert_configured(self):
        if not self.configured:
            raise RuntimeError("EVIDENCE_STORAGE_BUCKET is required for evidence storage")

    def put_bytes(
        self,
        *,
        key: str,
        payload: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        self._assert_configured()
        object_key = self._object_key(key)
        self.client.put_object(
            Bucket=self.settings.bucket,
            Key=object_key,
            Body=payload,
            ContentType=content_type,
            Metadata=metadata or {},
        )
        return f"s3://{self.settings.bucket}/{object_key}"

    def put_text(
        self,
        *,
        key: str,
        payload: str,
        content_type: str = "text/plain; charset=utf-8",
        metadata: Optional[Dict[str, str]] = None,
    ) -> str:
        return self.put_bytes(
            key=key,
            payload=payload.encode("utf-8"),
            content_type=content_type,
            metadata=metadata,
        )

    def parse_uri(self, uri: str) -> Tuple[str, str]:
        if not uri.startswith("s3://"):
            raise ValueError("Unsupported storage URI")
        without_scheme = uri[len("s3://") :]
        bucket, key = without_scheme.split("/", 1)
        return bucket, key

    def get_signed_url(self, uri: str, expires_seconds: Optional[int] = None) -> str:
        bucket, key = self.parse_uri(uri)
        ttl = expires_seconds or self.settings.signed_url_ttl_seconds
        return self.client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=ttl,
        )

    def get_bytes(self, uri: str) -> bytes:
        bucket, key = self.parse_uri(uri)
        obj = self.client.get_object(Bucket=bucket, Key=key)
        return obj["Body"].read()

    def head(self, uri: str) -> Dict[str, str]:
        bucket, key = self.parse_uri(uri)
        result = self.client.head_object(Bucket=bucket, Key=key)
        return {
            "content_type": result.get("ContentType", "application/octet-stream"),
            "size": str(result.get("ContentLength", 0)),
            "etag": str(result.get("ETag", "")).strip('"'),
        }
