from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class Asset(models.Model):
    TYPE_CHOICES = [
        ("repo", "Repository"),
        ("image", "Container Image"),
        ("host", "Host"),
        ("url", "URL"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="assets")
    asset_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    identifier = models.CharField(max_length=500)  # напр. URL репо / имя образа / hostname
    display_name = models.CharField(max_length=200, blank=True, default="")
    criticality = models.PositiveSmallIntegerField(default=3)  # 1..5, позже сделаем красивее
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "asset_type", "identifier"],
                name="uniq_asset_per_project",
            )
        ]


class ScanRun(models.Model):
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("processing", "Processing"),
        ("done", "Done"),
        ("failed", "Failed"),
    ]
    
    asset = models.ForeignKey(
    "core.Asset",
    on_delete=models.SET_NULL,
    null=True,
    blank=True,
    related_name="scan_runs",
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="scan_runs")
    tool_name = models.CharField(max_length=100)
    tool_version = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="queued")

    # ссылка на сырой отчёт (в MinIO/S3 позже)
    raw_uri = models.CharField(max_length=1000, blank=True, default="")
    raw_sha256 = models.CharField(max_length=64, blank=True, default="")

    # ключ идемпотентности: чтобы повторная загрузка того же отчёта не плодила ScanRun
    idempotency_key = models.CharField(max_length=100, blank=True, default="")

    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "tool_name", "idempotency_key"],
                name="uniq_scanrun_idempotency",
            )
        ]
        indexes = [
            models.Index(fields=["project", "status", "created_at"]),
        ]


class Finding(models.Model):
    SEVERITY_CHOICES = [
        ("info", "Info"),
        ("low", "Low"),
        ("medium", "Medium"),
        ("high", "High"),
        ("critical", "Critical"),
    ]

    STATUS_CHOICES = [
        ("new", "New"),
        ("triaged", "Triaged"),
        ("in_progress", "In Progress"),
        ("resolved", "Resolved"),
        ("false_positive", "False Positive"),
        ("risk_accepted", "Risk Accepted"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="findings")

    # главное поле анти-дублей: уникальный "отпечаток" находки
    fingerprint = models.CharField(max_length=128)

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="medium")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")

    vuln_id = models.CharField(max_length=200, blank=True, default="")     # CVE/CWE/ruleId
    category = models.CharField(max_length=100, blank=True, default="")    # SAST/DAST/SCA/etc
    component = models.CharField(max_length=300, blank=True, default="")   # пакет/модуль/endpoint
    location = models.CharField(max_length=1000, blank=True, default="")   # путь/URL/файл:строка

    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["project", "fingerprint"],
                name="uniq_finding_per_project_fingerprint",
            )
        ]
        indexes = [
            models.Index(fields=["project", "status", "severity"]),
            models.Index(fields=["project", "last_seen"]),
        ]


class Occurrence(models.Model):
    finding = models.ForeignKey(Finding, on_delete=models.CASCADE, related_name="occurrences")
    scan_run = models.ForeignKey(ScanRun, on_delete=models.CASCADE, related_name="occurrences")
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="occurrences")

    observed_at = models.DateTimeField(auto_now_add=True)
    evidence = models.JSONField(default=dict, blank=True)  # детали от сканера

    class Meta:
        indexes = [
            models.Index(fields=["finding", "observed_at"]),
            models.Index(fields=["scan_run"]),
        ]
