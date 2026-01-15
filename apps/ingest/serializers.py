"""Serializers for ingest API."""

from __future__ import annotations

from rest_framework import serializers


class IngestPayloadSerializer(serializers.Serializer):
    tool = serializers.CharField()
    scan_id = serializers.CharField()
    asset = serializers.CharField()
    title = serializers.CharField()
    severity = serializers.CharField()
    cve = serializers.CharField(required=False, allow_blank=True)
    cwe = serializers.CharField(required=False, allow_blank=True)
    path = serializers.CharField(required=False, allow_blank=True)
    port = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        normalized: dict[str, object] = {
            "tool": attrs["tool"].strip(),
            "scan_id": attrs["scan_id"].strip(),
            "asset": attrs["asset"].strip(),
            "title": attrs["title"].strip(),
            "severity": attrs["severity"].strip().lower(),
            "cve": (attrs.get("cve") or "").strip().upper() or None,
            "cwe": (attrs.get("cwe") or "").strip().upper() or None,
            "path": (attrs.get("path") or "").strip() or None,
            "port": attrs.get("port"),
        }
        return normalized


class IngestResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    task_id = serializers.CharField()


class IngestStatusSerializer(serializers.Serializer):
    status = serializers.CharField()
    fingerprint = serializers.CharField(required=False)
    error = serializers.CharField(required=False)
