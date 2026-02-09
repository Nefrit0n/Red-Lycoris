from fastapi.testclient import TestClient

from app import main


client = TestClient(main.app)


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_enqueue_scan_queues_task(monkeypatch):
    class DummyTask:
        id = "task-123"

    def fake_delay(payload):
        assert payload == {"scan_id": "scan-1"}
        return DummyTask()

    monkeypatch.setattr(main.parse_scan, "delay", fake_delay)

    response = client.post("/api/tasks/scan", json={"scan_id": "scan-1"})
    assert response.status_code == 200
    assert response.json() == {"task_id": "task-123", "status": "queued"}


def test_task_status_returns_result(monkeypatch):
    class DummyResult:
        state = "SUCCESS"
        result = {"status": "processed"}

        def successful(self):
            return True

    def fake_async_result(task_id):
        assert task_id == "task-123"
        return DummyResult()

    monkeypatch.setattr(main.parse_scan, "AsyncResult", fake_async_result)

    response = client.get("/api/tasks/task-123")
    assert response.status_code == 200
    assert response.json() == {
        "task_id": "task-123",
        "state": "SUCCESS",
        "result": {"status": "processed"},
    }
