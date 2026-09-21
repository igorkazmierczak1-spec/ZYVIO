---
name: EAS mobile archive
description: EAS monorepo archives can use the repository root, so mobile build hooks must tolerate both working directories.
---

EAS may archive a monorepo from its repository root even when the app and `eas.json` live in a nested mobile artifact. Build hooks must resolve their files from either the repository root or the mobile directory.

**Why:** Archive inspection showed the full repository was uploaded, and the cloud install ran against the root pnpm workspace. A hook assuming the mobile directory was current failed before dependency installation.

**How to apply:** Keep runtime workspace clients vendored inside the mobile artifact, use explicit dependency versions, generate the mobile lockfile independently, and make `eas-build-*` scripts detect the nearest workspace root rather than assuming `cwd`. When pnpm's workspace YAML defines `onlyBuiltDependencies`, update that ephemeral list for EAS; `.npmrc` additions alone may be ignored. Provision required public client variables explicitly in the EAS project environment; Replit workspace secrets are not inherited by cloud builds.