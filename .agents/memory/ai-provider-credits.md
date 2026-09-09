---
name: AI provider credits
description: VYBE AI depends on the configured OpenAI account having usable API credits.
---

The AI ideas endpoint is wired to the server-side OpenAI API key, but a valid key can still return an insufficient-quota response. The app should surface that state clearly rather than silently substituting generated or mock ideas.

**Why:** A smoke test showed the provider rejecting requests because the account had no remaining credits, which is distinct from a missing key or application bug.

**How to apply:** When working on VYBE AI, keep provider failures explicit and test the endpoint after credits are available.