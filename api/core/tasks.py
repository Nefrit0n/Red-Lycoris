from celery import shared_task
from core.models import ScanRun

@shared_task(ignore_result=True)
def process_scan_run(scan_run_id: int):
    sr = ScanRun.objects.get(id=scan_run_id)
    sr.status = "processing"
    sr.save(update_fields=["status"])

    # Пока заглушка: дальше тут будет парсинг отчёта → finding/occurrence
    sr.status = "done"
    sr.save(update_fields=["status"])
