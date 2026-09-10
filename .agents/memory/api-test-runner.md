---
name: API test runner
description: Environment constraint for bundled API tests that import the PostgreSQL client.
---

API integration tests that bundle the database client must run from an esbuild CommonJS bundle, not an ESM bundle.

**Why:** The PostgreSQL client uses dynamic CommonJS imports for Node built-ins; an esbuild ESM bundle fails at runtime with an unsupported dynamic require.

**How to apply:** Keep the test runner’s generated output in CommonJS and execute it with Node’s built-in test runner. Remove the temporary build directory after each run.