---
name: Render portability
description: External hosting needs portable database and media storage; Replit Object Storage sidecar is not available on Render.
---

Moving the API to Render requires an externally reachable PostgreSQL database, a schema bootstrap before the first server start, and a storage adapter that does not depend on Replit's local Object Storage sidecar.

**Why:** The API build can run on Render while the new external database is still empty; the server then starts but background jobs fail on missing tables. The current media implementation also signs URLs through a Replit-only local service, so setting the same environment variable names is not enough for uploads.

**How to apply:** Run the database schema push as part of the initial Render build, verify database connectivity, and migrate media storage before promising full media functionality.