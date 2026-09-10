---
name: Expo SDK dependency alignment
description: The mobile app uses Expo SDK 57 and native package versions must follow Expo’s compatibility check rather than older Clerk examples.
---

When adding Clerk dependencies to the Expo app, align `expo-auth-session`, `expo-crypto`, and `expo-secure-store` with the installed Expo SDK using Expo’s compatibility tooling. Clerk documentation can show version ranges for an older SDK.

**Why:** The Clerk setup reference listed SDK 54 versions, while this project runs SDK 57; keeping those versions caused the Expo compatibility check to fail even though TypeScript compiled.

**How to apply:** Run the Expo compatibility check from the mobile artifact after dependency changes and use the versions it reports for the current SDK.