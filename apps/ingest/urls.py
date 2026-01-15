"""URL routes for ingest app."""

from django.urls import path

from apps.ingest.views import IngestAPIView

urlpatterns = [
    path("api/ingest", IngestAPIView.as_view(), name="api-ingest"),
]
