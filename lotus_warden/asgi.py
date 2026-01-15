"""ASGI config for lotus_warden project."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "lotus_warden.settings")

application = get_asgi_application()
