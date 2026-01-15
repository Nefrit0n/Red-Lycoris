"""Views for ingest API."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ingest.dedup import handle_dedup
from apps.ingest.serializers import IngestPayloadSerializer


class IngestAPIView(APIView):
    def post(self, request):
        serializer = IngestPayloadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = handle_dedup(serializer.validated_data)
        return Response(result, status=status.HTTP_202_ACCEPTED)
