"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { useCallback } from "react";

import {
  PLAYGROUND_SHORTCUTS,
  type ShortcutCombo,
  shortcutKeys,
} from "@/lib/keyboard/shortcuts";

function isEditorFocused(): boolean {
  return document.activeElement?.closest(".cm-editor") != null;
}

interface UsePlaygroundShortcutsOptions {
  isRunning: boolean;
  showPlayback: boolean;
  canPlay: boolean;
  onRun: () => void;
  onPlayToggle: () => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onReset: () => void;
}

function useScopedHotkeys(
  keys: ShortcutCombo,
  callback: () => void,
  options: {
    enabled: boolean;
    scope: "global" | "editor";
    preventDefault?: boolean;
  },
) {
  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (options.preventDefault) event.preventDefault();
      callback();
    },
    [callback, options.preventDefault],
  );

  useHotkeys(
    shortcutKeys(keys),
    handler,
    {
      enabled: options.enabled,
      preventDefault: options.preventDefault,
      enableOnContentEditable: options.scope === "editor",
      ignoreEventWhen: options.scope === "global" ? isEditorFocused : undefined,
    },
    [handler, options.enabled, options.scope],
  );
}

/** Global keyboard shortcuts for run and step playback. */
export function usePlaygroundShortcuts({
  isRunning,
  showPlayback,
  canPlay,
  onRun,
  onPlayToggle,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onReset,
}: UsePlaygroundShortcutsOptions) {
  useHotkeys(
    shortcutKeys(PLAYGROUND_SHORTCUTS.run.global),
    (event) => {
      event.preventDefault();
      onRun();
    },
    {
      enabled: !isRunning,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isRunning, onRun],
  );

  useScopedHotkeys(PLAYGROUND_SHORTCUTS.playPause.global, onPlayToggle, {
    enabled: canPlay,
    scope: "global",
    preventDefault: true,
  });
  useScopedHotkeys(PLAYGROUND_SHORTCUTS.playPause.editor!, onPlayToggle, {
    enabled: canPlay,
    scope: "editor",
    preventDefault: true,
  });

  useScopedHotkeys(PLAYGROUND_SHORTCUTS.first.global, onFirst, {
    enabled: showPlayback,
    scope: "global",
    preventDefault: true,
  });
  useScopedHotkeys(PLAYGROUND_SHORTCUTS.first.editor!, onFirst, {
    enabled: showPlayback,
    scope: "editor",
    preventDefault: true,
  });

  useScopedHotkeys(PLAYGROUND_SHORTCUTS.prev.global, onPrev, {
    enabled: showPlayback,
    scope: "global",
    preventDefault: true,
  });
  useScopedHotkeys(PLAYGROUND_SHORTCUTS.prev.editor!, onPrev, {
    enabled: showPlayback,
    scope: "editor",
    preventDefault: true,
  });

  useScopedHotkeys(PLAYGROUND_SHORTCUTS.next.global, onNext, {
    enabled: showPlayback,
    scope: "global",
    preventDefault: true,
  });
  useScopedHotkeys(PLAYGROUND_SHORTCUTS.next.editor!, onNext, {
    enabled: showPlayback,
    scope: "editor",
    preventDefault: true,
  });

  useScopedHotkeys(PLAYGROUND_SHORTCUTS.last.global, onLast, {
    enabled: showPlayback,
    scope: "global",
    preventDefault: true,
  });
  useScopedHotkeys(PLAYGROUND_SHORTCUTS.last.editor!, onLast, {
    enabled: showPlayback,
    scope: "editor",
    preventDefault: true,
  });

  useScopedHotkeys(PLAYGROUND_SHORTCUTS.reset.global, onReset, {
    enabled: showPlayback,
    scope: "global",
    preventDefault: true,
  });
}
