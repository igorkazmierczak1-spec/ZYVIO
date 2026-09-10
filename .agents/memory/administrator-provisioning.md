---
name: Administrator provisioning
description: Security rule for creating the first VYBE administrator.
---

Do not automatically promote a VYBE account to `ADMIN` from `VYBE_ADMIN_USER_ID` during normal authentication or profile provisioning.

**Why:** The configured identifier previously pointed to the wrong account. Automatic promotion could silently grant full owner access to an unintended user.

**How to apply:** New Clerk profiles always start as `USER`. Bootstrap or recover the first administrator only through an explicit, verified database or owner-controlled operational procedure.