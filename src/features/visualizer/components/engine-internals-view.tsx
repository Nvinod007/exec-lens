"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { DashboardPanel } from "@/features/visualizer/components/dashboard-panel";
import type { ExecutionStep, QueueItem } from "@/types/execution";

interface EngineInternalsViewProps {
  step?: ExecutionStep;
  isRunning?: boolean;
}

const LOOP_STEPS = [
  {
    label: "1. Evaluate Script",
    phases: new Set<ExecutionStep["phase"]>([
      "evaluate-script",
      "run-sync",
      "schedule-microtask",
      "schedule-macrotask",
      "console",
    ]),
  },
  {
    label: "2. Run a Task",
    phases: new Set<ExecutionStep["phase"]>(["run-macrotask", "event-loop-tick"]),
  },
  {
    label: "3. Run all Microtasks",
    phases: new Set<ExecutionStep["phase"]>([
      "run-microtask",
      "await-suspend",
      "await-resume",
    ]),
  },
  {
    label: "4. Complete",
    phases: new Set<ExecutionStep["phase"]>(["complete", "error"]),
  },
] as const;

function QueueStrip({
  title,
  items,
  dot,
}: {
  title: string;
  items: QueueItem[];
  dot: "purple" | "yellow";
}) {
  return (
    <DashboardPanel title={title} count={items.length} dot={dot} className="shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0 text-[10px] font-bold">OUT ←</span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {items.length === 0 ? (
            <span className="text-muted-foreground text-xs">Empty</span>
          ) : (
            items.map((item, index) => (
              <motion.span
                key={item.id}
                layout
                className="bg-muted/60 shrink-0 rounded border border-border/50 px-2 py-1 font-mono text-xs"
              >
                {item.label}
                {index === 0 ? (
                  <span className="text-muted-foreground ml-1 text-[9px]">next</span>
                ) : null}
              </motion.span>
            ))
          )}
        </div>
        <span className="text-muted-foreground shrink-0 text-[10px] font-bold">→ IN</span>
      </div>
    </DashboardPanel>
  );
}

/** Event loop, queues, and web APIs — Engine Internals tab. */
export function EngineInternalsView({ step, isRunning = false }: EngineInternalsViewProps) {
  const phase = step?.phase ?? "evaluate-script";
  const webApis = step?.webApi ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="bg-card/60 flex shrink-0 flex-wrap items-center justify-center gap-1 rounded-lg border border-border/60 px-3 py-2 text-[10px] font-bold tracking-wide uppercase">
        <span className="text-blue-400">Call Stack</span>
        <ArrowRight className="text-muted-foreground size-3" />
        <span className="text-violet-400">Microtasks</span>
        <ArrowRight className="text-muted-foreground size-3" />
        <span className="text-muted-foreground">Render</span>
        <ArrowRight className="text-muted-foreground size-3" />
        <span className="text-amber-400">Macrotasks</span>
      </div>

      <DashboardPanel title="Event Loop Phase" dot="blue" className="shrink-0">
        <ol className="grid gap-1 sm:grid-cols-2">
          {LOOP_STEPS.map((loopStep) => {
            const isActive = loopStep.phases.has(phase);
            return (
              <li
                key={loopStep.label}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  isActive && "bg-primary/15 text-primary font-semibold",
                  isRunning && isActive && "animate-pulse",
                )}
              >
                {loopStep.label}
              </li>
            );
          })}
        </ol>
        {step?.label ? (
          <p className="text-muted-foreground mt-2 border-t border-border/50 pt-2 text-xs">
            {step.label}
          </p>
        ) : null}
      </DashboardPanel>

      <QueueStrip
        title="Microtask Queue"
        items={step?.microtaskQueue ?? []}
        dot="purple"
      />
      <QueueStrip
        title="Macrotask Queue"
        items={step?.macrotaskQueue ?? []}
        dot="yellow"
      />

      <DashboardPanel title="Web APIs" count={webApis.length} dot="green" className="min-h-0 flex-1">
        {webApis.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active APIs</p>
        ) : (
          <ul className="space-y-1 font-mono text-xs">
            {webApis.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        )}
      </DashboardPanel>
    </div>
  );
}
