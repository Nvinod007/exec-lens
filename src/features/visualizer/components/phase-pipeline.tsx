"use client";

import { cn } from "@/lib/utils";
import type { ExecutionStep } from "@/types/execution";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PhasePipelineProps {
  step?: ExecutionStep;
  isRunning?: boolean;
}

const PHASES = [
  {
    id: "eval",
    label: "Evaluate",
    short: "1",
    tip: "Run synchronous code on the call stack and schedule async work.",
  },
  {
    id: "task",
    label: "Macrotask",
    short: "2",
    tip: "Pick one callback from the macrotask queue (e.g. setTimeout).",
  },
  {
    id: "micro",
    label: "Microtasks",
    short: "3",
    tip: "Drain the entire microtask queue before rendering or the next macrotask.",
  },
  {
    id: "done",
    label: "Done",
    short: "4",
    tip: "Stack and queues are empty — execution finished.",
  },
] as const;

function getActivePhase(phase: ExecutionStep["phase"]): (typeof PHASES)[number]["id"] {
  switch (phase) {
    case "evaluate-script":
    case "run-sync":
    case "schedule-microtask":
    case "schedule-macrotask":
    case "console":
      return "eval";
    case "run-macrotask":
    case "event-loop-tick":
      return "task";
    case "run-microtask":
    case "await-suspend":
    case "await-resume":
      return "micro";
    case "complete":
    case "error":
      return "done";
    default: {
      const unreachable: never = phase;
      return unreachable;
    }
  }
}

/** Horizontal event-loop phase rail with tooltips on each step. */
export function PhasePipeline({ step, isRunning = false }: PhasePipelineProps) {
  const isError = step?.phase === "error";
  const active = getActivePhase(step?.phase ?? "evaluate-script");

  return (
    <div className="flex items-center gap-0.5">
      {PHASES.map((phase, index) => {
        const isLast = index === PHASES.length - 1;
        const isActive = phase.id === active;
        const label = isLast && isError ? "Error" : phase.label;
        const tip =
          isLast && isError
            ? "Execution stopped due to an unhandled error — stack and queues are cleared."
            : phase.tip;
        return (
          <div key={phase.id} className="flex min-w-0 flex-1 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex min-w-0 flex-1 cursor-help flex-col items-center rounded-lg px-1 py-1.5 transition-all",
                    isActive
                      ? isError && isLast
                        ? "bg-destructive/15 text-destructive ring-1 ring-destructive/30"
                        : "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "text-muted-foreground opacity-60",
                    isRunning && isActive && "animate-pulse",
                  )}
                >
                  <span className="font-mono text-xs font-bold">{phase.short}</span>
                  <span className="hidden truncate text-xs font-medium sm:block">{label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground border-border max-w-[200px] border text-xs">
                {tip}
              </TooltipContent>
            </Tooltip>
            {index < PHASES.length - 1 ? (
              <div
                className={cn(
                  "h-px w-2 shrink-0 sm:w-4",
                  isActive ? "bg-primary/40" : "bg-border",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
