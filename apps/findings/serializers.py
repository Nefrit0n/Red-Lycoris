"""Serializers for findings API."""

from __future__ import annotations

from rest_framework import serializers

from apps.findings.models import Finding


class FindingSerializer(serializers.ModelSerializer):
    asset = serializers.CharField(source="asset.identifier")
    tool = serializers.CharField(source="tool.name")
    scan = serializers.CharField(source="scan.name")
    fingerprint = serializers.CharField(source="fingerprint.value")

    class Meta:
        model = Finding
        fields = [
            "id",
            "title",
            "severity",
            "status",
            "cve",
            "cwe",
            "created_at",
            "asset",
            "tool",
            "scan",
            "fingerprint",
        ]
