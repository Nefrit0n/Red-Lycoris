import traceback
import sys
import hashlib
import tempfile

from django.db import IntegrityError
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from common.s3_storage import upload_fileobj_to_s3
from core.models import Project, Asset, ScanRun
from core.tasks import process_scan_run


def get_scan_run(request, scan_run_id: int):
    if request.method != "GET":
        return JsonResponse({"error": "use GET"}, status=405)

    try:
        sr = ScanRun.objects.select_related("project", "asset").get(id=scan_run_id)
    except ScanRun.DoesNotExist:
        return JsonResponse({"error": "not found"}, status=404)

    return JsonResponse(
        {
            "scan_run_id": sr.id,
            "project": sr.project.name,
            "asset": {
                "type": sr.asset.asset_type,
                "identifier": sr.asset.identifier,
            } if sr.asset else None,
            "tool_name": sr.tool_name,
            "tool_version": sr.tool_version,
            "status": sr.status,
            "raw_uri": sr.raw_uri,
            "sha256": sr.raw_sha256,
            "created_at": sr.created_at.isoformat(),
        }
    )

@csrf_exempt
def create_scan_run(request):
    try:
        if request.method != "POST":
            return JsonResponse({"error": "use POST"}, status=405)

        project_name = (request.POST.get("project") or "").strip()
        tool_name = (request.POST.get("tool_name") or "").strip()
        tool_version = (request.POST.get("tool_version") or "").strip()

        asset_type = (request.POST.get("asset_type") or "repo").strip()
        asset_identifier = (request.POST.get("asset_identifier") or "").strip()

        uploaded = request.FILES.get("file")
        if not project_name or not tool_name or not asset_identifier or not uploaded:
            return JsonResponse(
                {"error": "required: project, tool_name, asset_identifier, file"},
                status=400,
            )

        project, _ = Project.objects.get_or_create(name=project_name)
        asset, _ = Asset.objects.get_or_create(
            project=project,
            asset_type=asset_type,
            identifier=asset_identifier,
            defaults={"display_name": asset_identifier[:200]},
        )

        h = hashlib.sha256()
        with tempfile.NamedTemporaryFile("wb+", delete=True) as tmp:
            for chunk in uploaded.chunks():
                h.update(chunk)
                tmp.write(chunk)

            sha256_hex = h.hexdigest()
            tmp.seek(0)

            bucket = "raw-reports"
            key = f"{project.id}/{tool_name}/{sha256_hex}/{uploaded.name}"

            upload_fileobj_to_s3(
                tmp,
                bucket=bucket,
                key=key,
                content_type=getattr(uploaded, "content_type", None),
            )

            raw_uri = f"s3://{bucket}/{key}"

        idempotency_key = sha256_hex[:100]

        try:
            scan_run = ScanRun.objects.create(
                project=project,
                asset=asset,
                tool_name=tool_name,
                tool_version=tool_version,
                status="queued",
                raw_uri=raw_uri,
                raw_sha256=sha256_hex,
                idempotency_key=idempotency_key,
                started_at=timezone.now(),
            )
            process_scan_run.delay(scan_run.id)
            created = True
        except IntegrityError:
            scan_run = ScanRun.objects.get(
                project=project,
                tool_name=tool_name,
                idempotency_key=idempotency_key,
            )
            created = False

        return JsonResponse(
            {
                "scan_run_id": scan_run.id,
                "status": scan_run.status,
                "created": created,
                "raw_uri": scan_run.raw_uri,
                "sha256": scan_run.raw_sha256,
            },
            status=201 if created else 200,
        )

    except Exception as e:
        print("=== ERROR in create_scan_run ===", file=sys.stderr)
        traceback.print_exc()
        return JsonResponse({"error": str(e)}, status=500)
