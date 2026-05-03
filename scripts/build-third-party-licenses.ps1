$ErrorActionPreference = "Stop"

$root = Resolve-Path "$PSScriptRoot\.."
$out = Join-Path $root "THIRD_PARTY_LICENSES.md"

$header = @"
# Third-party licenses

This file lists third-party dependencies used by Red Lycoris.

Generated automatically from:
- Go backend dependencies
- Frontend npm production dependencies

> This report is provided for convenience and should be reviewed before release.

---

"@

Set-Content -Path $out -Value $header -Encoding UTF8

Add-Content -Path $out -Value "`n# Backend Go dependencies`n" -Encoding UTF8
Get-Content (Join-Path $root "licenses\backend-licenses.md") | Add-Content -Path $out -Encoding UTF8

Add-Content -Path $out -Value "`n---`n# Frontend npm dependencies`n" -Encoding UTF8
Get-Content (Join-Path $root "licenses\frontend-licenses.md") | Add-Content -Path $out -Encoding UTF8

Write-Host "Generated THIRD_PARTY_LICENSES.md"