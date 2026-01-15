from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("findings", "0001_initial"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="finding",
            constraint=models.UniqueConstraint(fields=["fingerprint"], name="find_fingerprint_uniq"),
        ),
    ]
