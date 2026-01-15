"""Views for ingest API."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ingest.serializers import IngestPayloadSerializer
from apps.ingest.tasks import ingest_finding_task


class IngestAPIView(APIView):
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
