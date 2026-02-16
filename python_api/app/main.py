import logging
from typing import Any, Dict

from fastapi import FastAPI

from app.tasks import parse_scan, sync_bdu

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("red_lycoris.api")

app = FastAPI(title="Red Lycoris Python API")


@app.get("/api/health")
def health_check() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/tasks/scan")
def enqueue_scan(payload: Dict[str, Any]) -> Dict[str, str]:
    task = parse_scan.delay(payload)
    logger.info("Enqueued scan task", extra={"task_id": task.id})
    return {"task_id": task.id, "status": "queued"}


@app.post("/api/tasks/bdu-sync")
def enqueue_bdu_sync(payload: Dict[str, Any] | None = None) -> Dict[str, str]:
    task = sync_bdu.delay(payload)
    logger.info("Enqueued BDU sync task", extra={"task_id": task.id})
    return {"task_id": task.id, "status": "queued"}


@app.get("/api/tasks/{task_id}")
def task_status(task_id: str) -> Dict[str, Any]:
    result = parse_scan.AsyncResult(task_id)
    response: Dict[str, Any] = {"task_id": task_id, "state": result.state}
    if result.successful():
        response["result"] = result.result
    return response
