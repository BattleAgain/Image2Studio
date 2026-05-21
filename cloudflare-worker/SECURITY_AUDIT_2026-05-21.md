# Image2Studio Cloud Security Audit — 2026-05-21

## Fixed

- Removed client-supplied `apiKey` from cloud task creation. Worker now uses `IMAGE_API_KEY` secret only.
- Restricted upstream `baseUrl` to HTTPS allowlist via `ALLOWED_BASE_ORIGINS`.
- Required `deviceToken` for all new tasks; legacy no-device fallback removed.
- Added per-device create-task rate limiting using D1 `rate_limits`.
- Locked `/admin`, `/api/admin/stats`, and `/api/tasks` list behind `IMAGE2STUDIO_ADMIN_TOKEN`.
- Public unauthenticated task list is no longer available.
- Edit-mode images must be data URLs; Worker no longer server-side fetches arbitrary URLs. This removes SSRF-style abuse risk.
- Removed `authorization` / `x-api-key` from CORS allowed headers; cloud client only needs `content-type`.
- Rotated admin token and removed old `ADMIN_TOKEN` secret. Current token is stored outside repo under `/var/minis/shared/Image2Studio-cloud-secrets/admin_token.txt`.

## Verification

- `/health` returns `2.3.0-security`.
- Unauthenticated `/api/tasks?limit=3` returns `401 admin auth required`.
- Unauthenticated `/api/admin/stats` returns `401 admin auth required`.
- Unauthenticated `/admin` returns login page with `401`.
- Source scan found no PAT/API key/private key literals in repo/cloud sources.
