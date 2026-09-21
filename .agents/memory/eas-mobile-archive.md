---
name: EAS mobile archive
description: EAS builds for the mobile artifact use the artifact directory as the cloud archive root.
---

The mobile EAS project must be self-contained inside `artifacts/vybe-mobile`: cloud dependency installation cannot resolve workspace packages, root pnpm catalogs, or parent-directory imports from the monorepo.

**Why:** The first Android build uploaded the mobile directory without the monorepo root and failed during dependency installation because `workspace:*` and `catalog:` references had no parent workspace context.

**How to apply:** Keep runtime workspace clients vendored inside the mobile artifact, use explicit dependency versions, and generate a lockfile in the mobile directory with workspace discovery disabled before starting an EAS build.