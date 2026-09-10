---
name: OpenAPI codegen naming
description: Orval naming collision caused by an operation that has both a path parameter and query parameters.
---

When an Orval operation has a path parameter and query parameters, the generated Zod path schema can reuse the same `*Params` name as the generated TypeScript query-parameter interface, causing a barrel export collision.

**Why:** The workspace codegen emits both `lib/api-zod/src/generated/api.ts` and `lib/api-zod/src/generated/types/`; the two generators do not namespace this mixed parameter shape consistently.

**How to apply:** Prefer a dedicated endpoint without query pagination for small private collections, or confirm the generated names before keeping a path-plus-query operation. Always rerun `pnpm --filter @workspace/api-spec run codegen` and the library typecheck after changing the spec.