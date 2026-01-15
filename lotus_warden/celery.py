"""Celery application configuration for Lotus Warden."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lotus_warden.settings")

app = Celery("lotus_warden")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
