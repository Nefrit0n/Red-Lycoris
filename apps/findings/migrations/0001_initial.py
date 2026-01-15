from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Asset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("asset_type", models.CharField(max_length=100)),
                ("identifier", models.CharField(max_length=255, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "indexes": [
                    models.Index(fields=["asset_type"], name="find_asset_type_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Fingerprint",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("value", models.CharField(max_length=128, unique=True)),
                ("algorithm", models.CharField(default="sha256", max_length=32)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="Tool",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, unique=True)),
                ("version", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="Scan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("started_at", models.DateTimeField(auto_now_add=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                (
                    "tool",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="scans",
                        to="findings.tool",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["started_at"], name="find_scan_start_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="Finding",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=255)),
                ("severity", models.CharField(max_length=50)),
                ("cve", models.CharField(blank=True, max_length=32)),
                ("cwe", models.CharField(blank=True, max_length=32)),
                ("status", models.CharField(max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "asset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="findings",
                        to="findings.asset",
                    ),
                ),
                (
                    "fingerprint",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="finding",
                        to="findings.fingerprint",
                    ),
                ),
                (
                    "scan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="findings",
                        to="findings.scan",
                    ),
                ),
                (
                    "tool",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="findings",
                        to="findings.tool",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(fields=["severity"], name="find_severity_idx"),
                    models.Index(fields=["status"], name="find_status_idx"),
                    models.Index(fields=["created_at"], name="find_created_at_idx"),
                    models.Index(fields=["cve"], name="find_cve_idx"),
                    models.Index(fields=["cwe"], name="find_cwe_idx"),
                ],
            },
        ),
    ]
