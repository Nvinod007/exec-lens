# Example snippets

Built-in examples live in `src/features/examples/data/example-snippets.ts`. Pick from the dropdown in the playground.

**19 examples** across these categories:

| Category | Count | Topics |
|----------|-------|--------|
| **event-loop** | 3 | Classic log order, microtasks vs macrotasks, nested timeouts |
| **promises** | 4 | `.then` chains, `new Promise`, rejection, TypeScript |
| **async-await** | 5 | Basics, sequential await, IIFE, delayed promises, rejection |
| **closures** | 2 | Classic `var` loop, closure counter |
| **hoisting** | 2 | Hoisting quiz, TDZ throw |
| **this-binding** | 3 | Method call, strict `undefined`, arrow lexical `this` |

## Tips

- Use **multiline snippets from the picker** — one-line copies may miss context the catalog expects.
- After **Run**, use **Play** or step keys to watch stack, queues, and scope change.
- **async-rejection** and **tdz-throw** intentionally show errors — read the teaching hint in the header for TDZ.

## Adding examples

Add an entry to `example-snippets.ts` with `id`, `title`, `description`, `category`, `language`, and `code`. Keep log order documented for QA.
