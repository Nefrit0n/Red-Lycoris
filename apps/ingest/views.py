"""Views for ingest API."""

from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ingest.serializers import (
    IngestPayloadSerializer,
    IngestResponseSerializer,
    IngestStatusSerializer,
)
from apps.ingest.tasks import ingest_finding_task


class IngestAPIView(APIView):
    @extend_schema(
        request=IngestPayloadSerializer,
        responses={202: IngestResponseSerializer},
        summary="Submit a finding payload for ingestion.",
    )
    def post(self, request):
        serializer = IngestPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        async_result = ingest_finding_task.delay(serializer.validated_data)
        return Response(
            {
                "status": "accepted",
                "task_id": async_result.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


class IngestStatusAPIView(APIView):
    @extend_schema(
        responses={200: IngestStatusSerializer},
        summary="Retrieve ingest task status.",
    )
    def get(self, request, task_id: str):
        async_result = ingest_finding_task.AsyncResult(task_id)
        payload: dict[str, str] = {"status": async_result.status}
        if async_result.successful():
            result = async_result.result
            if isinstance(result, dict) and result.get("fingerprint"):
                payload["fingerprint"] = str(result["fingerprint"])
        return Response(payload)
