# Keyboard Shortcuts

ExecLens uses **context-aware** shortcuts. Plain keys like `←` and `Space` control playback when focus is outside the editor. While you are typing in the snippet editor, **F-keys** handle playback so arrow keys still move the cursor.

On macOS, **Mod** = `⌘`. On Windows/Linux, **Mod** = `Ctrl`.

Hover any toolbar button to see its shortcut in the UI.

More context: [guide/PLAYGROUND.md](./guide/PLAYGROUND.md) · [guide/BREAKPOINTS.md](./guide/BREAKPOINTS.md)

## Run

| Action | Shortcut |
|--------|----------|
| Run snippet | `Mod+Enter` |

Works everywhere, including while the editor is focused.

## Playback (after Run)

| Action | Outside editor | While editing |
|--------|----------------|---------------|
| Play / Pause / Continue | `Space` | `F8` |
| Previous step | `←` | `F7` |
| Next step | `→` | `F9` |
| First step | `Mod+←` | `Shift+F7` |
| Last step | `Mod+→` | `Shift+F9` |
| Reset to first step | `Mod+Shift+R` | — |

**Continue** appears when paused at a [breakpoint](./guide/BREAKPOINTS.md) — same key as Play/Pause.

Reset only works when focus is outside the editor (`Mod+Shift+R` reloads the page on some browsers when the editor is focused).

## Breakpoints

Set breakpoints by **clicking line numbers** in the editor (not a keyboard shortcut). Step forward (`→` / `F9`) and auto-play both **pause** when the current step hits a marked line.

See [guide/BREAKPOINTS.md](./guide/BREAKPOINTS.md) for limits (playback pause vs VM debugger).

## Tips

- Run a snippet first — playback shortcuts are active only after a successful run.
- Click a panel or the timeline row to use arrow keys and `Space` for stepping.
- Stay in the editor and use **F7 / F8 / F9** to step without leaving the keyboard.

## macOS reference

| Key | Label |
|-----|-------|
| Mod | `⌘` |
| Shift | `⇧` |
| Enter | `↵` |
