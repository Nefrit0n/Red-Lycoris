// Package v1 defines API contract DTOs for Lotus Warden.
//
// Contract versioning:
//   - v1 is the current stable contract.
//   - Backward-compatible changes must be additive only.
//
// Extension rules:
//   - New fields must be optional (pointer or `omitempty`).
//   - Existing required fields must not change meaning or type.
//   - Clients should ignore unknown fields.
package v1
