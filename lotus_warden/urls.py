"""URL configuration for lotus_warden project."""
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def healthcheck(_request):
    return HttpResponse("ok")


def hello_world(_request):
    return HttpResponse("Hello World")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", healthcheck),
    path("hello/", hello_world),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/schema/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    path("", include("apps.ingest.urls")),
    path("", include("apps.findings.urls")),
]
