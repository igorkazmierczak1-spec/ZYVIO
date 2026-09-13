---
name: Premium plan source of truth
description: Centralized Premium and Premium Pro limits, benefits, and XP multipliers must drive both enforcement and UI.
---

Plan limits and benefits belong in one backend configuration. API enforcement, plan comparison screens, AI allowances, and XP rewards should consume that configuration rather than maintain separate numeric copies.

**Why:** Separate frontend/backend values make subscription changes appear active while old limits remain enforced, especially across Stripe web and RevenueCat mobile paths.

**How to apply:** Add new plan benefits to the central backend config first, expose them through a typed endpoint, regenerate OpenAPI clients, then update web and mobile consumers.