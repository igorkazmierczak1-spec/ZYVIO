---
name: RevenueCat relationship mutations
description: Non-obvious RevenueCat v2 API behavior for configuring products, entitlements, offerings, and packages.
---

RevenueCat v2 uses action endpoints for relationship changes: product attachment requires an `actions/attach_products` route, and offering updates use POST-style resource updates. Creating an offering does not accept `is_current` in its body.

**Why:** The collection URLs may look writable, but they return method or parameter errors for these operations even when the same resources can be listed and created successfully.

**How to apply:** When maintaining RevenueCat setup scripts, verify the installed SDK's generated operation URL and method before calling a relationship mutation; keep setup scripts idempotent and tolerate already-attached products.