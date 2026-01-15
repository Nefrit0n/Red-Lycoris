"""URL routes for ingest app."""

from django.urls import path

from apps.ingest.views import IngestAPIView, IngestStatusAPIView

urlpatterns = [
    path("api/ingest/", IngestAPIView.as_view(), name="api-ingest"),
    path("api/ingest/<str:task_id>/", IngestStatusAPIView.as_view(), name="api-ingest-status"),
]
