"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GripHorizontal } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { ActionTooltip } from "@/components/shared/action-tooltip";
import { HintLabel } from "@/components/shared/hint-label";
import { formatConsoleTimestamp } from "@/lib/utils";
import type { ConsoleEntry } from "@/types/execution";

/** Minimum visible log lines (~4 lines at text-sm). */
const MIN_LOG_LINES = 4;
const LINE_HEIGHT_PX = 24;
const MIN_LOG_HEIGHT_PX = MIN_LOG_LINES * LINE_HEIGHT_PX;

interface ConsoleDockProps {
  entries: ConsoleEntry[];
  position: "top" | "bottom";
  onReposition: (position: "top" | "bottom") => void;
}

/** Console strip — fills its pane, min 3 lines, scrolls when output grows. */
export function ConsoleDock({ entries, position, onReposition }: ConsoleDockProps) {
  const onGripDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const startY = event.clientY;
    const target = event.currentTarget;

    const onMove = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientY - startY;
      if (position === "bottom" && delta < -80) onReposition("top");
      if (position === "top" && delta > 80) onReposition("bottom");
    };

    const onUp = () => {
      target.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    target.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className="bg-console-dock flex h-full min-h-0 flex-col overflow-hidden border-border/60 data-[position=bottom]:border-t data-[position=top]:border-b"
      data-position={position}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-1.5">
        <ActionTooltip label="Move">
          <div
            role="button"
            tabIndex={0}
            onPointerDown={onGripDrag}
            className="text-muted-foreground hover:text-primary flex cursor-grab items-center rounded p-0.5 active:cursor-grabbing"
            aria-label="Move output panel"
          >
            <GripHorizontal className="size-4" />
          </div>
        </ActionTooltip>
        <HintLabel
          label="Output"
          tip="console.log results with wall-clock timestamps and source line numbers. Drag the grip to dock at top; resize for height."
          hint={`${entries.length}`}
          className="text-xs font-semibold tracking-wider uppercase"
        />
      </div>
      <div
        className="flex-1 overflow-y-auto px-3 pb-3 font-mono text-sm leading-6"
        style={{ minHeight: MIN_LOG_HEIGHT_PX }}
      >
        <AnimatePresence mode="popLayout">
          {entries.length === 0 ? (
            <p className="text-muted-foreground/70 text-sm">
              Logs appear here as you step through execution.
            </p>
          ) : (
            entries.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-2 py-0.5"
              >
                <span className="text-muted-foreground/80 w-[9rem] shrink-0 whitespace-nowrap tabular-nums">
                  {entry.timestamp != null
                    ? formatConsoleTimestamp(entry.timestamp)
                    : "—"}
                </span>
                <span className="text-primary/70 w-[2.75rem] shrink-0 tabular-nums">
                  {entry.line != null ? `L${entry.line}` : "L?"}
                </span>
                <span className="text-teal-500/70 shrink-0 select-none">&gt;</span>
                <span className="min-w-0 break-all">{entry.values.join(" ")}</span>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
