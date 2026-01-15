import multiprocessing
import os

bind = os.getenv("GUNICORN_BIND", "unix:/run/gunicorn/lotus_warden.sock")
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
threads = int(os.getenv("GUNICORN_THREADS", "4"))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "sync")
worker_tmp_dir = "/dev/shm"
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "100"))
accesslog = os.getenv("GUNICORN_ACCESS_LOG", "-")
errorlog = os.getenv("GUNICORN_ERROR_LOG", "-")
loglevel = os.getenv("GUNICORN_LOG_LEVEL", "info")

def _default_workers():
    cpu_count = multiprocessing.cpu_count()
    return max(2, cpu_count * 2 + 1)

if os.getenv("GUNICORN_WORKERS_AUTO", "false").lower() == "true":
    workers = int(os.getenv("GUNICORN_WORKERS", str(_default_workers())))
