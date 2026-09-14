---
name: Database schema build artifacts
description: Workspace TypeScript consumers can typecheck against emitted database declarations instead of the edited source.
---

After changing the shared database schema, rebuild the database project before typechecking dependent API packages; otherwise stale emitted declarations can report missing columns even when the source schema is correct.

**Why:** The workspace package exposes source at runtime but project references can still resolve declaration output from the database package during API checks.

**How to apply:** Run the database project build first, then typecheck and build API consumers. Treat a missing-column type error as potentially stale declarations before changing the schema again.