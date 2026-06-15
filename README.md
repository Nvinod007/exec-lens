# ExecLens

**See JavaScript execute** — a step-by-step visualizer for the call stack, event loop, scope, and async behavior. Inspired by [JS Visualizer 9000](https://www.jsv9000.app/) with real Promises, async/await, and teaching overlays.

## Features

- **Event loop** — call stack, microtask queue, macrotask queue, phase rail
- **Native Promise & async/await** — real Node instrumentation, not a fake Promise shim
- **Virtual clock** — `setTimeout` shows logical delay (e.g. `+5000ms`) without waiting
- **Scope panel** — live variables, closure captures, hoisting preview, **`this`** binding
- **Teaching** — TDZ static check + hints, hoisting step, closure capture steps
- **Editor** — CodeMirror, step highlight, lint, **breakpoints** (playback pause)
- **Playground** — Run vs Play, collapsible Current step, layout prefs, localStorage session
- **19 examples** — event loop, promises, async, closures, hoisting, TDZ, `this`
- JavaScript & TypeScript (esbuild + source maps)
- Dark/light theme, keyboard shortcuts

## Documentation

| Doc | Description |
|-----|-------------|
| [guide/README.md](./guide/README.md) | Index — playground, breakpoints, examples |
| [KEYBOARD_SHORTCUTS.md](./KEYBOARD_SHORTCUTS.md) | Run & playback shortcuts |
| [guide/BREAKPOINTS.md](./guide/BREAKPOINTS.md) | Breakpoint behavior & limits (playback pause, not a VM debugger) |

Local agent/planning docs (`docs/AGENT_CONTEXT.md`, `docs/PROJECT_PLAN.md`) are gitignored and optional for contributors.

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Editor | CodeMirror 6 |
| Runner | Node.js — instrumentation, virtual clock, scope/closure/`this` hooks |
| AST | Acorn + esbuild source maps |

## Project structure

```
src/
├── app/api/run/          # POST — execute snippet, return steps
├── features/
│   ├── editor/           # CodeMirror, breakpoints gutter
│   ├── visualizer/       # Stack, queues, scope, timeline
│   ├── playground/       # Page composition, localStorage
│   └── examples/         # Curated snippets
├── lib/
│   ├── ast/              # Parse, scopes, closures, hoisting, TDZ
│   └── runner/           # Sandbox + step recorder
└── types/execution.ts    # ExecutionStep, ScopeBinding, ThisBinding, …
```

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), pick an example, **Run** (`Mod+Enter`), then **Play** or step with `F7`/`F8`/`F9`.

See [guide/PLAYGROUND.md](./guide/PLAYGROUND.md) for panel overview.

## Docker (optional)

```bash
docker compose up --build
```

No `.env` file required for local dev or Docker — the runner uses built-in defaults (`MAX_RUNNER_STEPS=5000`, `RUNNER_TIMEOUT_MS=10000`). Docker Compose sets the same limits inline in `docker-compose.yml`. Optional overrides: copy `.env.example` → `.env.local` (local) or edit `docker-compose.yml` (Docker).

## API

`POST /api/run`

```json
{ "code": "console.log('hello');", "language": "javascript" }
```

Returns `{ steps, error?, errorLine?, teachingHint?, language }`.

## Roadmap

- Phase 1–2 ✅ Foundation + real async engine
- Phase 3 ✅ AST, scope, closures, hoisting, TDZ, `this`
- Phase 4 — Share URLs, guided modules, E2E

## License

MIT
