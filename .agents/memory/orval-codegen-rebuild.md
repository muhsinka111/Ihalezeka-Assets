---
name: Orval codegen → rebuild api-zod declarations
description: After regenerating OpenAPI codegen, consumers read stale api-zod .d.ts until the composite project's declarations are rebuilt.
---

After running `pnpm --filter @workspace/api-spec run codegen` (orval), the
generated source in `lib/api-zod/src/generated/` is updated, but consumer
packages (e.g. `artifacts/api-server`) typecheck against the **emitted
declarations** in `lib/api-zod/dist/*.d.ts`, not the source.

`lib/api-zod` is a `composite` + `emitDeclarationOnly` TS project referenced via
`references` in consumers' tsconfig. Its `dist` `.d.ts` files are NOT regenerated
by orval and have no `build` npm script. If you skip rebuilding them, consumers
see the OLD API shape and report phantom errors like `Property 'x' does not exist`.

**Why:** project references resolve types from the referenced project's declared
`outDir` (dist), so stale dist masks fresh source.

**How to apply:** after any codegen change, run
`npx tsc -b lib/api-zod --force` to regenerate declarations, then re-run the
consumer typecheck. Also clear stale `.tsbuildinfo` if incremental cache lies.

Related: the spec/generated set can drift — the committed generated files may
contain query params (e.g. tenders `category`) that no longer exist in
`openapi.yaml`. Re-running codegen drops them. If a route/frontend still uses the
param, ADD it to `openapi.yaml` before regenerating, don't just regenerate.

Same mechanism applies to `lib/db` (also `composite` + `emitDeclarationOnly`):
after changing an EXPORTED type in `lib/db/src/schema` (e.g. adding `fax` to
`TenderContact`), run `tsc -b lib/db --force` or consumers typecheck against
stale `lib/db/dist/*.d.ts`. Runtime is unaffected — tsx resolves `@workspace/db`
to src via package.json `exports` — so only `tsc` sees the stale shape.
