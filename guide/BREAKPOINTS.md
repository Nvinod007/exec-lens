# Breakpoints

## How to use

1. **Run** a snippet first (breakpoints apply during playback, not during the API run).
2. Click a **line number** in the editor gutter (or the gutter dot area) to toggle a red breakpoint.
3. **Play** or **Step forward** — playback **pauses** when a step’s editor line matches a breakpoint.
4. Stats bar shows `N bp · paused` when stopped on a hit. **Play** becomes **Continue** until the next breakpoint or end.
5. Click the line again to remove the breakpoint.

Breakpoint lines are saved in `localStorage` with other layout preferences.

## What “pause” means

ExecLens breakpoints are **playback pause**, not a true VM debugger.

| Works | Does not |
|-------|----------|
| Pauses when a **recorded timeline step** maps to your breakpoint line (`getStepEditorLine`) | Stop inside every internal engine step (e.g. some microtask substeps with no mapped user line) |
| Auto-play and manual step-forward both stop on hit | Break inside native code or instrumentation hooks |
| Multiple breakpoints — pauses at each in order while playing | Conditional breakpoints, watch expressions, edit-and-continue |

### Practical tips

- Put breakpoints on lines that produce steps: `console.log`, assignments, function calls, `await`, etc.
- If playback “skips” a line you marked, that line may not have its own step in the timeline (common for empty lines or some async internals).
- For teaching, breakpoints are enough to pause **before/after** a `console.log` or on a specific `await`.

## Related

- [Playground](./PLAYGROUND.md) — Run vs Play
- [Keyboard shortcuts](../KEYBOARD_SHORTCUTS.md) — `F9` step forward stops on breakpoints too
