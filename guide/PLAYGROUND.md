# Playground

## Run vs Play

| Control | When | What it does |
|---------|------|----------------|
| **Run** | Always available | Sends snippet to the server, builds the full step timeline. Clears stale viz if you edited after a previous run. |
| **Play / Pause** | After a successful Run | Auto-advances steps on a timer. Label becomes **Continue** when paused at a [breakpoint](./BREAKPOINTS.md). |
| **Step ← / →** | After Run | Move one step backward or forward manually. |

Keyboard: [KEYBOARD_SHORTCUTS.md](../KEYBOARD_SHORTCUTS.md).

## Runtime panels

After **Run**, the right-hand (or bottom) area shows:

| Panel | Purpose |
|-------|---------|
| **Current step** | Human-readable label + event-loop phase rail. Collapse with the chevron to save space on long snippets. |
| **Call stack** | Active frames (top = running). Duplicate names show **task callback** vs **function body**. |
| **Microtask / Macrotask queues** | What is scheduled next in the event loop. |
| **Scope** | Live `let`/`const`/`var`/params, hoisting preview, closure captures, and **`this`** for the selected frame. |
| **Console** | Output with source lines and timestamps. |

The editor highlights the **current source line** (`getStepEditorLine`) during playback.

## Editor

- **Syntax lint** — errors inline before Run.
- **Breakpoints** — click a line number in the gutter (red dot). See [Breakpoints](./BREAKPOINTS.md).
- **Custom code** — editing away from a loaded example switches the picker to **Custom code**; draft is saved locally.

## Layout & persistence

Stored in browser `localStorage` (no account):

- Editor / console placement and split ratios
- Last example or custom draft
- Collapsed **Current step** panel state
- Breakpoint line numbers
- Theme (via next-themes, separate key)

Layout controls are in the playground toolbar. Refresh keeps your session.

## Teaching overlays

Some runs include special first steps or hints:

- **Hoisting** — amber overlay listing lifted `var` / `function` declarations (`decl Ln` = declaration line).
- **TDZ** — static check before run; error + teaching hint in the header if you access `let`/`const` too early.
- **Closures** — “Captured from outer scope” when an inner function closes over variables.

Use the matching examples in [Examples](./EXAMPLES.md).

## Limits (by design)

- Snippets run in a **sandboxed Node runner**, not a full browser.
- No `fs`, network, or npm imports.
- Not a replacement for Chrome DevTools — optimized for **teaching** the event loop and scope concepts.
