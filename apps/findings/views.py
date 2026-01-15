"""Views for findings API."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.findings.models import Finding
from apps.findings.serializers import FindingSerializer


class FindingListAPIView(APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="severity",
                description="Filter by severity.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="tool",
                description="Filter by tool name.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="asset",
                description="Filter by asset identifier.",
                required=False,
                type=str,
            ),
            OpenApiParameter(
                name="status",
                description="Filter by status.",
                required=False,
                type=str,
            ),
        ],
        responses={200: FindingSerializer(many=True)},
        summary="List findings with optional filters.",
    )
    def get(self, request):
        queryset = Finding.objects.select_related(
            "asset",
            "tool",
            "scan",
            "fingerprint",
        ).order_by("-created_at")
        severity = request.query_params.get("severity")
        if severity:
            queryset = queryset.filter(severity=severity.strip().lower())
        tool = request.query_params.get("tool")
        if tool:
            queryset = queryset.filter(tool__name=tool.strip())
        asset = request.query_params.get("asset")
        if asset:
            queryset = queryset.filter(asset__identifier=asset.strip())
        status = request.query_params.get("status")
        if status:
            queryset = queryset.filter(status=status.strip().lower())
        serializer = FindingSerializer(queryset, many=True)
        return Response(serializer.data)
