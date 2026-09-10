---
name: Mobile preview CORS
description: Development CORS behavior for the Expo mobile preview calling the shared API.
---

The API must allow the Expo preview origin from `REPLIT_EXPO_DEV_DOMAIN` in development. Without it, browser-based Expo preview requests fail during the `OPTIONS` preflight and the mobile React Query screens remain stuck in loading.

**Why:** The Expo preview runs on a separate Replit domain from the API's normal `REPLIT_DEV_DOMAIN`, so a strict allowlist that includes only the latter rejects valid mobile preview requests.

**How to apply:** Keep the Expo domain as an explicit development origin candidate in the API CORS configuration. Do not replace the allowlist with a wildcard, especially because the API uses credentials and bearer-authenticated requests.