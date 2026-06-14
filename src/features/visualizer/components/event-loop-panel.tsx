"use client";

import { cn } from "@/lib/utils";
import { RuntimePanel } from "@/features/visualizer/components/runtime-panel";
import type { ExecutionStep } from "@/types/execution";

interface EventLoopPanelProps {
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
    phases: new Set<ExecutionStep["phase"]>(["run-microtask"]),
  },
  {
    label: "4. Complete",
    phases: new Set<ExecutionStep["phase"]>(["complete", "error"]),
  },
] as const;

/** Numbered event-loop steps like JS Visualizer 9000. */
export function EventLoopPanel({ step, isRunning = false }: EventLoopPanelProps) {
  const phase = step?.phase ?? "evaluate-script";

  return (
    <RuntimePanel title="Event Loop" tone="loop" className="min-h-0 flex-1">
      <div className="flex h-full min-h-[140px] flex-col justify-between gap-2">
        <ol className="space-y-1.5 text-sm font-medium">
          {LOOP_STEPS.map((loopStep) => {
            const isActive = loopStep.phases.has(phase);
            return (
              <li
                key={loopStep.label}
                className={cn(
                  "rounded px-2 py-1 transition-colors",
                  isActive && "bg-panel-item font-bold shadow-sm",
                  isRunning && isActive && "animate-pulse",
                )}
              >
                {loopStep.label}
              </li>
            );
          })}
        </ol>

        {step?.label ? (
          <p className="border-t border-black/10 pt-2 text-xs leading-snug opacity-80 dark:border-white/10">
            {step.label}
          </p>
        ) : (
          <p className="text-xs opacity-50">Press Run to begin</p>
        )}

        {step?.webApi && step.webApi.length > 0 ? (
          <div className="space-y-0.5 border-t border-black/10 pt-2 dark:border-white/10">
            {step.webApi.map((entry) => (
              <p key={entry} className="font-mono text-[11px] opacity-75">
                {entry}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </RuntimePanel>
  );
}
