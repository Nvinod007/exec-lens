/** Hotkey strings for react-hotkeys-hook (`mod` = ⌘ on Mac, Ctrl on Windows). */
export type ShortcutCombo = string | readonly string[];

export type ShortcutBinding = {
  /** When focus is outside the editor (e.g. ← moves timeline). */
  global: ShortcutCombo;
  /** While typing in the editor — must not steal arrow keys / space. */
  editor?: ShortcutCombo;
};

/**
 * Playback shortcuts use two layers:
 * - `global` — plain keys for panels/controls (disabled while editor focused)
 * - `editor` — F-keys that work while editing (debugger-style)
 */
export const PLAYGROUND_SHORTCUTS = {
  run: { global: "mod+enter", editor: "mod+enter" },
  playPause: { global: "space", editor: "f8" },
  first: { global: "mod+arrowleft", editor: "shift+f7" },
  prev: { global: "arrowleft", editor: "f7" },
  next: { global: "arrowright", editor: "f9" },
  last: { global: "mod+arrowright", editor: "shift+f9" },
  reset: { global: "mod+shift+r" },
} as const satisfies Record<string, ShortcutBinding>;

export type PlaygroundShortcutId = keyof typeof PLAYGROUND_SHORTCUTS;

export function shortcutKeys(combo: ShortcutCombo): readonly string[] {
  return typeof combo === "string" ? [combo] : combo;
}

/** All combos to show in a tooltip (global + editor, deduped). */
export function shortcutTooltipCombos(binding: ShortcutBinding): readonly string[] {
  const combos = [...shortcutKeys(binding.global)];
  if (binding.editor) {
    for (const key of shortcutKeys(binding.editor)) {
      if (!combos.includes(key)) combos.push(key);
    }
  }
  return combos;
}
