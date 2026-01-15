"""Deduplication handler for incoming findings."""

from __future__ import annotations

import hashlib
from typing import Any


def handle_dedup(payload: dict[str, Any]) -> dict[str, Any]:
    """Handle deduplication for a normalized payload.

    For now, compute a fingerprint and return it for downstream processing.
    """

    fingerprint_input = "|".join(
        str(payload.get(key) or "")
        for key in (
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
    )
    fingerprint = hashlib.sha256(fingerprint_input.encode("utf-8")).hexdigest()
    return {
        "status": "accepted",
        "fingerprint": fingerprint,
    }
