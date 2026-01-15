from django.db import models


class Asset(models.Model):
    name = models.CharField(max_length=255)
    asset_type = models.CharField(max_length=100)
    identifier = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["asset_type"], name="find_asset_type_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.asset_type})"


class Tool(models.Model):
    name = models.CharField(max_length=255, unique=True)
    version = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class Scan(models.Model):
    tool = models.ForeignKey(Tool, on_delete=models.PROTECT, related_name="scans")
    name = models.CharField(max_length=255)
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["started_at"], name="find_scan_start_idx"),
        ]

    def __str__(self) -> str:
        return self.name


class Fingerprint(models.Model):
    value = models.CharField(max_length=128, unique=True)
    algorithm = models.CharField(max_length=32, default="sha256")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.value


class Finding(models.Model):
    fingerprint = models.OneToOneField(
        Fingerprint,
        on_delete=models.PROTECT,
        related_name="finding",
    )
    title = models.CharField(max_length=255)
    severity = models.CharField(max_length=50)
    asset = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="findings")
    tool = models.ForeignKey(Tool, on_delete=models.PROTECT, related_name="findings")
    scan = models.ForeignKey(Scan, on_delete=models.PROTECT, related_name="findings")
    cve = models.CharField(max_length=32, blank=True)
    cwe = models.CharField(max_length=32, blank=True)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["severity"], name="find_severity_idx"),
            models.Index(fields=["status"], name="find_status_idx"),
            models.Index(fields=["created_at"], name="find_created_at_idx"),
            models.Index(fields=["cve"], name="find_cve_idx"),
            models.Index(fields=["cwe"], name="find_cwe_idx"),
        ]

    def __str__(self) -> str:
        return self.title
