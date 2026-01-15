import os

bind = f"0.0.0.0:{os.getenv('PYTHON_API_PORT', '8000')}"
workers = int(os.getenv('GUNICORN_WORKERS', '2'))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "uvicorn.workers.UvicornWorker")
timeout = int(os.getenv("GUNICORN_TIMEOUT", "60"))
accesslog = "-"
errorlog = "-"
