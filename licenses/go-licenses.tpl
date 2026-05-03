{{ range . }}
### {{ .Name }}

- Version: `{{ .Version }}`
- License: {{ .LicenseName }}
- License URL: {{ .LicenseURL }}

{{ if .LicenseText }}
<details>
<summary>License text</summary>

```text
{{ .LicenseText }}
</details> {{ end }}

{{ end }}