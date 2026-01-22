import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, RefResolver

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = Path(
    Path.cwd() / "backend" / "openapi.json"
    if (Path.cwd() / "backend" / "openapi.json").exists()
    else ROOT / "backend" / "openapi.json"
)

FIXTURES = {
    "contracts/fixtures/v1/findings_list.json": {
        "type": "array",
        "items": {"$ref": "#/components/schemas/FindingListItemDTO"},
    },
    "contracts/fixtures/v1/finding_detail_sca.json": {
        "$ref": "#/components/schemas/FindingDetailSCA"
    },
    "contracts/fixtures/v1/finding_detail_sast.json": {
        "$ref": "#/components/schemas/FindingDetailSAST"
    },
    "contracts/fixtures/v1/import_job.json": {
        "$ref": "#/components/schemas/ImportJobStatusDTO"
    },
    "contracts/fixtures/v1/metrics_timeseries.json": {
        "$ref": "#/components/schemas/MetricsTimeSeriesDTO"
    },
    "contracts/fixtures/v1/metrics_breakdown.json": {
        "$ref": "#/components/schemas/MetricsBreakdownDTO"
    },
}


def main() -> int:
    if not SPEC_PATH.exists():
        print(f"OpenAPI spec not found at {SPEC_PATH}", file=sys.stderr)
        return 1

    with SPEC_PATH.open() as f:
        spec = json.load(f)

    resolver = RefResolver.from_schema(spec)
    errors = []

    for rel_path, schema in FIXTURES.items():
        fixture_path = ROOT / rel_path
        if not fixture_path.exists():
            errors.append(f"Missing fixture: {rel_path}")
            continue

        with fixture_path.open() as f:
            instance = json.load(f)

        validator = Draft7Validator(schema, resolver=resolver)
        for error in sorted(validator.iter_errors(instance), key=lambda e: e.path):
            errors.append(f"{rel_path}: {error.message}")

    if errors:
        print("Fixture validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Fixture validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
