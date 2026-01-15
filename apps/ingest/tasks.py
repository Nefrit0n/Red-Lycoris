"""Celery tasks for ingest pipeline."""

from __future__ import annotations

from celery import shared_task

from apps.ingest.dedup import handle_dedup


@shared_task(bind=True)
def ingest_finding_task(self, payload: dict[str, object]) -> dict[str, str]:
    """Normalize payload, compute fingerprint, and store finding."""

    result = handle_dedup(payload)
    return {"status": result["status"], "fingerprint": result["fingerprint"]}
