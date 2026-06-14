import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";

export interface EditorShortcutHandlers {
  onRun?: () => void;
  runDisabled?: () => boolean;
  onPlayToggle?: () => void;
  onFirst?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLast?: () => void;
  playbackEnabled?: () => boolean;
  canPlay?: () => boolean;
}

/** Editor keymap — Mod+Enter + F-keys for playback while the snippet editor is focused. */
export function createEditorShortcutKeymap(handlers: EditorShortcutHandlers): Extension[] {
  const bindings: { key: string; run: () => boolean }[] = [];

  if (handlers.onRun) {
    bindings.push({
      key: "Mod-Enter",
      run: () => {
        if (handlers.runDisabled?.()) return false;
        handlers.onRun?.();
        return true;
      },
    });
  }

  if (handlers.onPrev) {
    bindings.push({
      key: "F7",
      run: () => {
        if (!handlers.playbackEnabled?.()) return false;
        handlers.onPrev?.();
        return true;
      },
    });
  }

  if (handlers.onPlayToggle) {
    bindings.push({
      key: "F8",
      run: () => {
        if (!handlers.canPlay?.()) return false;
        handlers.onPlayToggle?.();
        return true;
      },
    });
  }

  if (handlers.onNext) {
    bindings.push({
      key: "F9",
      run: () => {
        if (!handlers.playbackEnabled?.()) return false;
        handlers.onNext?.();
        return true;
      },
    });
  }

  if (handlers.onFirst) {
    bindings.push({
      key: "Shift-F7",
      run: () => {
        if (!handlers.playbackEnabled?.()) return false;
        handlers.onFirst?.();
        return true;
      },
    });
  }

  if (handlers.onLast) {
    bindings.push({
      key: "Shift-F9",
      run: () => {
        if (!handlers.playbackEnabled?.()) return false;
        handlers.onLast?.();
        return true;
      },
    });
  }

  if (bindings.length === 0) return [];

  return [Prec.highest(keymap.of(bindings))];
}
