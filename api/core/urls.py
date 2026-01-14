from django.urls import path
from core import views

urlpatterns = [
    path("api/scan-runs", views.create_scan_run),
    path("api/scan-runs/<int:scan_run_id>", views.get_scan_run),
]
