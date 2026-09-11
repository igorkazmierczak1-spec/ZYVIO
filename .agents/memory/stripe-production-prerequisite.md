---
name: Stripe production prerequisite
description: Conditions that must be true before configuring VYBE's production Stripe webhook
---

VYBE's production Stripe endpoint can only be created after the API is published and returns a real production URL, and the Stripe connector must remain attached to the environment.

**Why:** Stripe cannot deliver to a workspace-only URL, and removing the connector removes the server-side API credential path used by the billing routes.

**How to apply:** Check deployment metadata first, then verify the Stripe integration is attached. If either is missing, complete only reversible test-mode setup and report the external blocker instead of claiming production billing is active.