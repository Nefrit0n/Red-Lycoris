from fastapi.testclient import TestClient

from app import main


client = TestClient(main.app)


def test_health_check():
    response = client.get("/api/health")
    if response.status_code != 200:
        raise AssertionError("Expected status code 200.")
    if response.json() != {"status": "ok"}:
        raise AssertionError("Expected health check response payload.")


def test_enqueue_scan_queues_task(monkeypatch):
    class DummyTask:
        id = "task-123"

    def fake_delay(payload):
        if payload != {"scan_id": "scan-1"}:
            raise AssertionError("Expected scan payload.")
        return DummyTask()

    monkeypatch.setattr(main.parse_scan, "delay", fake_delay)

    response = client.post("/api/tasks/scan", json={"scan_id": "scan-1"})
    if response.status_code != 200:
        raise AssertionError("Expected status code 200.")
    if response.json() != {"task_id": "task-123", "status": "queued"}:
        raise AssertionError("Expected queued task response payload.")


def test_task_status_returns_result(monkeypatch):
    class DummyResult:
        state = "SUCCESS"
        result = {"status": "processed"}

        def successful(self):
            return True

    def fake_async_result(task_id):
        if task_id != "task-123":
            raise AssertionError("Expected task id.")
        return DummyResult()

    monkeypatch.setattr(main.parse_scan, "AsyncResult", fake_async_result)

    response = client.get("/api/tasks/task-123")
    if response.status_code != 200:
        raise AssertionError("Expected status code 200.")
    if response.json() != {
        "task_id": "task-123",
        "state": "SUCCESS",
        "result": {"status": "processed"},
    }:
        raise AssertionError("Expected task status response payload.")
