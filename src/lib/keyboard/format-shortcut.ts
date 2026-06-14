import {
  PLAYGROUND_SHORTCUTS,
  type PlaygroundShortcutId,
  type ShortcutBinding,
  shortcutTooltipCombos,
} from "@/lib/keyboard/shortcuts";

const KEY_LABELS: Record<string, { mac: string; win: string }> = {
  mod: { mac: "⌘", win: "Ctrl" },
  shift: { mac: "⇧", win: "Shift" },
  alt: { mac: "⌥", win: "Alt" },
  enter: { mac: "↵", win: "Enter" },
  space: { mac: "Space", win: "Space" },
  arrowleft: { mac: "←", win: "←" },
  arrowright: { mac: "→", win: "→" },
  r: { mac: "R", win: "R" },
  f7: { mac: "F7", win: "F7" },
  f8: { mac: "F8", win: "F8" },
  f9: { mac: "F9", win: "F9" },
};

/** Format a react-hotkeys-hook combo for tooltip display on the current OS. */
export function formatShortcut(combo: string, isMac: boolean): string {
  return combo
    .split("+")
    .map((part) => {
      const labels = KEY_LABELS[part.toLowerCase()];
      if (labels) return isMac ? labels.mac : labels.win;
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(isMac ? "" : "+");
}

/** Tooltip text for a binding — shows global + editor keys, e.g. `← · F7`. */
export function formatShortcutBinding(binding: ShortcutBinding, isMac: boolean): string {
  return shortcutTooltipCombos(binding)
    .map((combo) => formatShortcut(combo, isMac))
    .join(" · ");
}

export function playgroundShortcutLabel(id: PlaygroundShortcutId, isMac: boolean): string {
  return formatShortcutBinding(PLAYGROUND_SHORTCUTS[id], isMac);
}
