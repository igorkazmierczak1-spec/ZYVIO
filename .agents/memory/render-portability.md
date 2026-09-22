---
name: Render portability
description: External hosting needs portable database and media storage; Replit Object Storage sidecar is not available on Render.
---

Moving the API to Render requires an externally reachable PostgreSQL database and a storage adapter that does not depend on Replit's local Object Storage sidecar.

**Why:** The API build can run on Render, but the current media implementation signs URLs through a Replit-only local service, so setting the same environment variable names is not enough for uploads.

**How to apply:** Treat `render.yaml` as service deployment configuration only; verify database connectivity and migrate media storage before promising full media functionality.