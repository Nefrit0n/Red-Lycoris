import logging
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
