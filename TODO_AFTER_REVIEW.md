# TODO after code review

- Investigate why `go test ./...` hangs in the backend (module download vs. tests waiting on external services).
- Add integration tests for RBAC on bulk findings actions and delete endpoints.
- Add stricter upload validation for scanner reports (content-type and schema validation).
- Consider cursor-based pagination for large findings lists.
