"use client";

import { motion, AnimatePresence } from "framer-motion";

import { HintLabel } from "@/components/shared/hint-label";
import { LensPanel } from "@/features/visualizer/components/lens-panel";
import { PhasePipeline } from "@/features/visualizer/components/phase-pipeline";
import { cn } from "@/lib/utils";
import type { CallStackFrame, ExecutionStep, QueueItem } from "@/types/execution";

interface RuntimeDashboardProps {
  step?: ExecutionStep;
  frames: CallStackFrame[];
  breakpoints: number[];
  isRunning?: boolean;
}

function QueueLane({
  label,
  tip,
  items,
  tone,
}: {
  label: string;
  tip: string;
  items: QueueItem[];
  tone: "microtask" | "macrotask";
}) {
  const barClass =
    tone === "microtask" ? "bg-microtask/20 text-microtask" : "bg-macrotask/20 text-macrotask";

  return (
    <div className="space-y-1">
      <HintLabel
        label={label}
        tip={tip}
        hint={`${items.length}`}
        className="text-xs font-semibold tracking-wide uppercase"
      />
      <div className="bg-muted/25 flex min-h-[44px] min-w-[4rem] items-center gap-1.5 overflow-x-auto rounded-lg border border-border/40 px-2 py-1.5">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <span className="text-muted-foreground/60 text-sm italic">empty</span>
          ) : (
            items.map((item, index) => (
              <motion.span
                key={item.id}
                layout
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 font-mono text-sm",
                  barClass,
                  index === 0 && "ring-1 ring-current/35",
                )}
              >
                {item.label}
              </motion.span>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Unified runtime view — stack, loop, queues, scope, breakpoints, APIs together. */
export function RuntimeDashboard({
  step,
  frames,
  breakpoints,
  isRunning = false,
}: RuntimeDashboardProps) {
  const topDown = [...frames].reverse();

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <LensPanel
        label="Current step"
        tooltip="What the runtime is doing right now — updates as you step through execution."
        accent="teal"
        className="shrink-0"
      >
        <p className="mb-2 text-sm leading-snug">
          {step?.label ?? "Run a snippet to begin stepping through execution."}
        </p>
        <PhasePipeline step={step} isRunning={isRunning} />
      </LensPanel>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:grid-rows-[minmax(8rem,auto)_auto_minmax(4.5rem,9rem)]">
      <LensPanel
        label="Call stack"
        hint={`${frames.length}`}
        tooltip="Active function frames. New calls animate in from the top; returns animate out upward. Top frame runs first (LIFO)."
        accent="amber"
        className="min-h-0 lg:row-start-1"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {topDown.length === 0 ? (
              <p className="text-muted-foreground m-auto text-center text-sm">
                No frames yet
              </p>
            ) : (
              topDown.map((frame, index) => (
                <motion.div
                  key={frame.id}
                  layout
                  initial={{ opacity: 0, y: -18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  className={cn(
                    "rounded-lg border border-border/50 bg-muted/40 px-3 py-2 font-mono text-sm",
                    index === 0 && "border-primary/40 bg-primary/10 ring-1 ring-primary/20",
                  )}
                >
                  {frame.label}
                  {frame.line ? (
                    <span className="text-muted-foreground ml-2 opacity-70">
                      :{frame.line}
                    </span>
                  ) : null}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </LensPanel>

      <LensPanel
        label="Task queues"
        tooltip="Microtasks (Promises) drain before the next macrotask. Tasks enter from the right and leave from the left."
        accent="slate"
        className="min-h-[8rem] lg:row-start-1"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <QueueLane
            label="Microtasks"
            tip="Promise.then and queueMicrotask callbacks — always run before the next macrotask."
            items={step?.microtaskQueue ?? []}
            tone="microtask"
          />
          <QueueLane
            label="Macrotasks"
            tip="setTimeout, setInterval, and I/O callbacks — one macrotask per event loop turn."
            items={step?.macrotaskQueue ?? []}
            tone="macrotask"
          />
        </div>
      </LensPanel>

      <LensPanel
        label="Scope"
        hint="Phase 3"
        tooltip="Local variables and closure captures — available after scope-chain instrumentation lands in Phase 3."
        accent="slate"
        className="min-h-[4.5rem] lg:row-start-2"
      >
        <p className="text-muted-foreground text-sm">No variables in scope yet.</p>
      </LensPanel>

      <LensPanel
        label="Breakpoints"
        hint={`${breakpoints.length}`}
        tooltip="Lines you marked in the editor. Full pause-on-hit arrives in a later phase."
        accent="rose"
        className="min-h-[4.5rem] lg:row-start-2"
      >
        {breakpoints.length === 0 ? (
          <p className="text-muted-foreground text-sm">Click a line number to mark one.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {breakpoints.map((line) => (
              <li
                key={line}
                className="rounded-md bg-rose-500/10 px-2 py-0.5 font-mono text-sm text-rose-400"
              >
                L{line}
              </li>
            ))}
          </ul>
        )}
      </LensPanel>

      <LensPanel
        label="Web APIs"
        hint={`${step?.webApi?.length ?? 0}`}
        tooltip="Browser/Node timers and I/O registered outside the JS thread — they enqueue macrotasks when done."
        accent="teal"
        className="min-h-[4.5rem] lg:col-span-2 lg:row-start-3"
      >
        {!step?.webApi?.length ? (
          <p className="text-muted-foreground text-sm">No active timers or I/O.</p>
        ) : (
          <ul className="max-h-full min-h-[2.5rem] space-y-1 overflow-y-auto font-mono text-sm">
            {step.webApi.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        )}
      </LensPanel>
        </div>
      </div>
    </div>
  );
}
