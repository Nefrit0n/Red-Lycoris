"""URL routes for findings app."""

from django.urls import path

from apps.findings.views import FindingListAPIView

urlpatterns = [
    path("api/findings/", FindingListAPIView.as_view(), name="api-findings"),
]
