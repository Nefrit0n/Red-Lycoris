# API Contracts v1 (Stable)

## Compatibility & Extension Rules

### Responses
- **Additive only.** New fields may be added as optional, but existing fields and their meaning must not change.
- **No removals or renames.** Existing fields remain available for the lifetime of v1.

### Request Bodies
- **Unknown fields are ignored** for JSON request bodies in v1 (Go JSON decoding behavior).
- **Clients MUST NOT send unknown fields** for `PUT` requests, since `PUT` is treated as a full replace of the resource shape.
- If strict request validation is introduced in a future version, it will be announced via a new version (e.g., v2).

## Finding Details (Discriminated Union)

Finding detail responses use a **discriminator** on `category` (`SAST`, `SCA`, `SECRETS`, `CONFIG`) and return typed details in the `details` field:
- `details` matches one of:
  - `FindingDetailsSAST`
  - `FindingDetailsSCA`
  - `FindingDetailsSecrets`
  - `FindingDetailsConfig`

This keeps the v1 contract stable while allowing additive fields within each detail shape.
