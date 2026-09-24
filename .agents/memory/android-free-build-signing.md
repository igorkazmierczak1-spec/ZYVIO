---
name: Android free builds and signing
description: Free GitHub Actions can produce Android builds for a public repository, but Google Play updates require an accepted upload-key signature.
---

For this project, a free standard GitHub-hosted runner is a viable alternative to a paid EAS Android build because the source repository is public. A downloadable AAB is not sufficient by itself: Google Play must accept its upload-key signature. The signing key is not present in the workspace, and exposing a private key in workflow logs or artifacts is unsafe.

**Why:** Rebuilding with a new key can cause Google Play to reject an update even when the app code and package ID are correct. Users also need a usable artifact link, not just a configured workflow.

**How to apply:** Before promising a Play-ready AAB, confirm the app's Play App Signing/upload-key state and arrange a secure signing credential in GitHub Actions secrets, or follow Google's supported upload-key reset flow. Keep private signing files and values out of the repository, logs, and public artifacts.