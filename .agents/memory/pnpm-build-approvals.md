---
name: pnpm build approvals
description: Compatibility rule for dependency install scripts across local pnpm and EAS build environments.
---

Remote EAS builds can run a newer pnpm major version than the workspace's local toolchain. In pnpm 11, `allowBuilds` replaces the older `onlyBuiltDependencies` setting; keeping only the older key can still produce `ERR_PNPM_IGNORED_BUILDS` in the remote install.

**Why:** A production Android build previously passed local checks but failed remotely during dependency installation because the remote pnpm did not honor the older approval setting.

**How to apply:** When local and EAS pnpm versions may differ, define the narrowly scoped approved package map with `allowBuilds` and retain `onlyBuiltDependencies` only as compatibility support for pnpm 10. Do not enable all dependency scripts globally.