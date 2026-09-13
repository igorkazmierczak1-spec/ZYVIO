---
name: React Query singleton
description: Preventing provider-context failures when workspace packages bundle React Query separately.
---

Treat TanStack React Query as a frontend singleton. Vite applications that consume the linked workspace API client must deduplicate `@tanstack/react-query` alongside React and React DOM.

**Why:** A production bundle can resolve two React Query installations through different workspace dependency paths. The provider then initializes one context while generated API hooks read another and throw “No QueryClient set.”

**How to apply:** Keep provider and hook imports on the same package version and include React Query in Vite’s `resolve.dedupe` list whenever linked workspace packages import it.