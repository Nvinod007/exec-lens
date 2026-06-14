# ExecLens

**See JavaScript execute** — a step-by-step visualizer for the call stack, microtask queue, callback queue, and event loop. Inspired by [JS Visualizer 9000](https://www.jsv9000.app/).

## Features (v0.1)

- **Native Promise** and **async/await** execution with real Node instrumentation
- **Virtual clock** for `setTimeout` — logical delays (`+5000ms`) without real wait time
- Live code editor with **active line highlighting** during playback
- **Call stack**, **microtask queue**, **callback queue**, and **event loop** panels
- Step timeline with play / pause / scrub controls
- Curated examples (event loop, promises, timeouts)
- JavaScript and TypeScript snippet support (TS compiled via esbuild)
- Dark/light theme (shadcn-style UI + Framer Motion icons)
- Keyboard shortcuts for run and step playback — see [KEYBOARD_SHORTCUTS.md](./KEYBOARD_SHORTCUTS.md)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Editor | CodeMirror 6 |
| Runner | Node.js — native `Promise`, `async_hooks`, virtual timer clock |
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

Keyboard shortcuts: [KEYBOARD_SHORTCUTS.md](./KEYBOARD_SHORTCUTS.md) (`Mod+Enter` to run; `F7` / `F8` / `F9` to step while editing).

## Docker (optional)

Isolated deployment with memory limits and runner timeouts (see `.env.example`):

```bash
docker compose up --build
```

Env keys: `RUNNER_TIMEOUT_MS`, `MAX_RUNNER_STEPS`, `MAX_SNIPPET_LENGTH`.

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

- Phase 2 ✅ Real async engine (Promises, async/await, virtual clock)
- Phase 3: Hoisting, TDZ, scope chain (AST overlay)
- Phase 4: Share URLs, guided modules, E2E

## License

MIT
