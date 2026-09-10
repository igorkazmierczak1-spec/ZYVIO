---
name: Stripe webhook retries
description: Idempotency handling for Stripe webhook events that can fail during downstream synchronization
---

Record the webhook event before processing to deduplicate concurrent deliveries, but remove the claim when processing fails so a transient Stripe or database error remains retryable.

**Why:** A permanent pre-processing claim makes Stripe believe the event was handled even when subscription synchronization failed.

**How to apply:** Keep successful event claims durable; on any processing error, compensate the claim and rethrow so the HTTP handler returns a failure and Stripe retries.