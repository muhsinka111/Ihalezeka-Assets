---
name: Drizzle array in ANY() pitfall
description: How to pass a JS array as a PostgreSQL array in a Drizzle sql`` template literal.
---

## The rule
When you interpolate a plain JS array inside a Drizzle `sql\`\`` template tag, Drizzle expands it as a row expression: `ANY(($1, $2, $3))`. PostgreSQL's `ANY()` requires an array type, not a row expression — this causes the query to fail with:
```
op ANY/ALL (array) requires array on right side
```

## Fix
Use `ARRAY[...]` syntax built with `sql.join`:
```typescript
import { sql } from "drizzle-orm";

// WRONG — generates ANY(($1,$2,$3)) → runtime error
sql`column = ANY(${myArray})`

// CORRECT — generates ANY(ARRAY[$1, $2, $3])
const arr = sql.join(myArray.map(v => sql`${v}`), sql`, `);
sql`column = ANY(ARRAY[${arr}])`
```

**Why:** Drizzle's parameterization of JS arrays uses positional row syntax, not PG array literals. `sql.join` with `ARRAY[]` wrapper is the idiomatic workaround.

**How to apply:** Any time you write a dynamic `= ANY(...)` or `IN (...)` clause with a runtime JS array, use this pattern. `sql.join` is available in drizzle-orm@0.45.x (confirmed in this codebase).
