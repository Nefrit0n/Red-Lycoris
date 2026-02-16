import logging
import os
import time
from typing import Any, Dict

from app.celery_app import celery_app

logger = logging.getLogger("red_lycoris.tasks")


@celery_app.task(bind=True, name="red_lycoris.parse_scan")
def parse_scan(self, payload: Dict[str, Any]) -> Dict[str, Any]:
    logger.info(
        "Starting scan parse", extra={"task_id": self.request.id, "payload": payload}
    )
    time.sleep(2)
    result = {
        "status": "processed",
        "scan_id": payload.get("scan_id", "unknown"),
        "details": payload,
    }
    logger.info(
        "Completed scan parse", extra={"task_id": self.request.id, "result": result}
    )
    return result


@celery_app.task(bind=True, name="red_lycoris.sync_bdu")
def sync_bdu(self, payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """Download BDU FSTEC vullist.xlsx and sync into local PostgreSQL database."""
    from app.bdu_sync import BDU_XLSX_URL, download_xlsx, parse_and_store

    task_id = self.request.id
    url = (payload or {}).get("url", BDU_XLSX_URL)
    logger.info("Starting BDU sync (task=%s, url=%s)", task_id, url)

    xlsx_path = download_xlsx(url)
    try:
        result = parse_and_store(xlsx_path)
    finally:
        try:
            os.unlink(xlsx_path)
        except OSError:
            pass

    logger.info("BDU sync finished (task=%s): %s", task_id, result)
    return result
