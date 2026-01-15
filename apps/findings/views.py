"""Views for findings API."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import ListAPIView

from apps.findings.models import Finding
from apps.findings.serializers import FindingSerializer


def _split_param(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


class FindingListAPIView(ListAPIView):
    serializer_class = FindingSerializer

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="severity",
                description="Filter by severity (comma-separated).",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="tool",
                description="Filter by tool name (comma-separated).",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="asset",
                description="Filter by asset identifier (comma-separated).",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="status",
                description="Filter by status (comma-separated).",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="cve",
                description="Filter by CVE identifier (comma-separated).",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="cwe",
                description="Filter by CWE identifier (comma-separated).",
                required=False,
                type=str,
            ),
        ],
        responses={200: FindingSerializer(many=True)},
        summary="List findings with optional filters.",
    )
    def get_queryset(self):
        queryset = Finding.objects.select_related(
            "asset",
            "tool",
            "scan",
            "fingerprint",
        ).order_by("-created_at")
        params = self.request.query_params
        severities = [value.lower() for value in _split_param(params.get("severity"))]
        if severities:
            queryset = queryset.filter(severity__in=severities)
        tools = _split_param(params.get("tool"))
        if tools:
            queryset = queryset.filter(tool__name__in=tools)
        assets = _split_param(params.get("asset"))
        if assets:
            queryset = queryset.filter(asset__identifier__in=assets)
        statuses = [value.lower() for value in _split_param(params.get("status"))]
        if statuses:
            queryset = queryset.filter(status__in=statuses)
        cves = [value.upper() for value in _split_param(params.get("cve"))]
        if cves:
            queryset = queryset.filter(cve__in=cves)
        cwes = [value.upper() for value in _split_param(params.get("cwe"))]
        if cwes:
            queryset = queryset.filter(cwe__in=cwes)
        return queryset
