# ExecLens

**See JavaScript execute** — a step-by-step visualizer for the call stack, microtask queue, callback queue, and event loop. Inspired by [JS Visualizer 9000](https://www.jsv9000.app/).

## Features (v0.1)

- Live code editor with **active line highlighting** during playback
- **Call stack**, **microtask queue**, **callback queue**, and **event loop** panels
- Step timeline with play / pause / scrub controls
- Curated examples (event loop, promises, timeouts)
- JavaScript and TypeScript snippet support (TS compiled via esbuild)
- Dark/light theme (shadcn-style UI + Framer Motion icons)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Editor | CodeMirror 6 |
| Runner | Node.js sandbox with patched timers & Promises |
| TS compile | esbuild |

## Project Structure

Feature-based folders — each domain owns its UI, hooks, and data:

```
src/
├── app/                    # Next.js routes + API
│   └── api/run/            # POST — execute snippet, return steps
├── features/
│   ├── editor/             # CodeMirror editor
│   ├── visualizer/         # Stack, queues, timeline panels
│   ├── playground/         # Main page composition
│   └── examples/           # Curated snippets
├── lib/
│   └── runner/             # Sandbox + step recorder
├── components/ui/          # shadcn primitives
└── types/                  # Shared execution types
```

See [docs/PROJECT_PLAN.md](./docs/PROJECT_PLAN.md) for the full roadmap.

**For AI agents / new contributors:** read [docs/AGENT_CONTEXT.md](./docs/AGENT_CONTEXT.md) first — why we built this, stack decisions, goals, and codebase map.

## Quick Start

```bash
# Install
npm install

# Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), pick an example, click **Run**, then step through the timeline.

## Docker (optional)

For isolated deployment of the full app:

```bash
docker compose up --build
```

## API

`POST /api/run`

```json
{
  "code": "console.log('hello');",
  "language": "javascript"
}
```

Returns `{ steps: ExecutionStep[], error?: string, language }`.

## Roadmap Highlights

- Phase 2: Real Node instrumentation (`async_hooks`, V8 inspector)
- Phase 3: Hoisting, TDZ, scope chain (AST overlay)
- Phase 4: async/await in sandbox, closures, `this`

## License

MIT
