FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY gunicorn.conf.py ./gunicorn.conf.py
COPY trigger_task.py ./trigger_task.py

EXPOSE 8000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "app.main:app"]
