| Package | Version | License | License URL |
|---|---:|---|---|
{{- range . }}
| `{{ .Name }}` | `{{ .Version }}` | {{ .LicenseName }} | {{ .LicenseURL }} |
{{- end }}