---
name: Expo build Metro port
description: Port isolation needed when the Expo static build runs alongside the mockup sandbox
---

The Expo static build must run Metro on a port separate from the mockup sandbox. The build script uses `METRO_PORT` when provided and otherwise defaults to 8082; all health checks, bundle downloads, manifests, and asset URLs use that same port.

**Why:** The mockup sandbox commonly occupies port 8081. Expo's default port caused a non-interactive build prompt to switch ports, which made the static build time out.

**How to apply:** Keep Metro's port configurable and pass it explicitly to Expo whenever running the mobile production build in a workspace with other Vite services.