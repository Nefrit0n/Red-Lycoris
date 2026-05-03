$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot\.."
$out = Join-Path $root "THIRD_PARTY_LICENSES.md"

$header = @"
# Third-party licenses

This file lists third-party dependencies used by Red Lycoris.

Generated from:
- Go backend dependencies
- Frontend npm production dependencies

> This report is provided for convenience and should be reviewed before release.

---

## Backend Go dependencies

"@

Set-Content -Path $out -Value $header -Encoding UTF8

Get-Content (Join-Path $root "licenses\backend-licenses.md") -Encoding UTF8 |
  Add-Content -Path $out -Encoding UTF8

Add-Content -Path $out -Value @"

---

## Frontend npm dependencies

"@ -Encoding UTF8

Get-Content (Join-Path $root "licenses\frontend-licenses.md") -Encoding UTF8 |
  Add-Content -Path $out -Encoding UTF8

Write-Host "Generated THIRD_PARTY_LICENSES.md"