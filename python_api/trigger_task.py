import json
import os

from app.tasks import parse_scan

payload = {
    "scan_id": os.getenv("SCAN_ID", "demo-scan"),
    "source": "script",
}

result = parse_scan.delay(payload)
print(json.dumps({"task_id": result.id, "status": "queued"}))
print("Waiting for result...")
print(result.get(timeout=15))
