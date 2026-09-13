---
name: Clerk profile reprovisioning
description: How to preserve a ZYVIO profile when Clerk recreates an identity with a new user ID.
---

When a Clerk identity is missing by ID, check for an existing local profile with the same verified, normalized primary email before inserting a new profile. Reuse that profile rather than creating a duplicate.

**Why:** Deleting and recreating a Clerk user can change its Clerk user ID while preserving the email. A local unique-email constraint then makes an ID-only provisioning flow silently skip insertion and fail authentication.

**How to apply:** Only link on a primary email Clerk reports as verified. Preserve blocked/deleted account checks, and make concurrent provisioning safe when an insert loses a uniqueness race.