---
name: Scoped router authorization
description: Prevent role-specific Express middleware from intercepting unrelated application routes.
---

When an Express router is mounted globally, scope its authentication and role middleware to the same URL prefix as its routes. A router-level `use()` without a path runs before route matching and can reject unrelated requests.

**Why:** A globally mounted billing-admin router applied its administrator check to normal profile, dashboard, notification, and battle requests. Administrator accounts worked while every ordinary user received `403`, which made the issue appear account-specific.

**How to apply:** For routers that retain full route paths internally, attach middleware to the shared prefix. Alternatively mount the router at that prefix and make its internal paths relative. Verify an unrelated route can pass the router without invoking its role guard.