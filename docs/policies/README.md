# Policy examples (Rego)

This directory contains example policies intended for local evaluation and review.

## Local validation (optional)

If you have OPA installed:

```bash
opa check examples/*.rego
```

To evaluate with a sample input JSON:

```bash
opa eval -i input.json -d examples/sla_critical_age.rego "data.lotus.policies.sla_v1"
```

OPA is not required for CI at this stage; these commands are for local experimentation only.
