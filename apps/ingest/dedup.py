"""Deduplication handler for incoming findings."""

from __future__ import annotations

import hashlib
from typing import Any

from django.db import transaction

from apps.findings.models import Asset, Finding, Fingerprint, Scan, Tool

FINGERPRINT_KEYS = (
    "tool",
    "scan_id",
    "asset",
    "title",
    "severity",
    "cve",
    "cwe",
    "path",
    "port",
)


def normalize_fingerprint_payload(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize ingest data for fingerprinting.

    Examples (normalization behavior):
        - severity: " High " -> "high"
        - cve: " cve-2023-123 " -> "CVE-2023-123"
        - path: " /login " -> "/login"; empty -> None
    """

    return {
        "tool": str(data.get("tool") or "").strip(),
        "scan_id": str(data.get("scan_id") or "").strip(),
        "asset": str(data.get("asset") or "").strip(),
        "title": str(data.get("title") or "").strip(),
        "severity": str(data.get("severity") or "").strip().lower(),
        "cve": (str(data.get("cve") or "").strip().upper() or None),
        "cwe": (str(data.get("cwe") or "").strip().upper() or None),
        "path": (str(data.get("path") or "").strip() or None),
        "port": data.get("port"),
    }


def make_fingerprint(data: dict[str, Any]) -> str:
    """Build a stable fingerprint from normalized ingest data.

    The input is normalized before hashing to avoid whitespace/casing issues.
    """

    normalized = normalize_fingerprint_payload(data)
    fingerprint_input = "|".join(str(normalized.get(key) or "") for key in FINGERPRINT_KEYS)
    return hashlib.sha256(fingerprint_input.encode("utf-8")).hexdigest()


def handle_dedup(payload: dict[str, Any]) -> dict[str, Any]:
    """Handle deduplication for a normalized payload.

    For now, compute a fingerprint and return it for downstream processing.
    """

    normalized = normalize_fingerprint_payload(payload)
    fingerprint = make_fingerprint(normalized)

    with transaction.atomic():
        tool, _ = Tool.objects.get_or_create(name=normalized["tool"])
        scan, _ = Scan.objects.get_or_create(tool=tool, name=normalized["scan_id"])
        asset_identifier = normalized["asset"]
        asset, _ = Asset.objects.get_or_create(
            identifier=asset_identifier,
            defaults={
                "name": asset_identifier,
                "asset_type": "unknown",
            },
        )
        fingerprint_obj, _ = Fingerprint.objects.get_or_create(value=fingerprint)
        Finding.objects.update_or_create(
            fingerprint=fingerprint_obj,
            defaults={
                "title": normalized["title"],
                "severity": normalized["severity"],
                "asset": asset,
                "tool": tool,
                "scan": scan,
                "cve": normalized["cve"] or "",
                "cwe": normalized["cwe"] or "",
                "status": "open",
            },
        )
    return {
        "status": "accepted",
        "fingerprint": fingerprint,
    }
