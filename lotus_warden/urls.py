"""URL configuration for lotus_warden project."""
from django.contrib import admin
from django.http import HttpResponse
from django.urls import path


def healthcheck(_request):
    return HttpResponse("ok")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", healthcheck),
]
