"""WSGI config for lotus_warden project."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lotus_warden.settings")

application = get_wsgi_application()
