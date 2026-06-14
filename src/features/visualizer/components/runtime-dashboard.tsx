"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { HintLabel } from "@/components/shared/hint-label";
import { LensPanel } from "@/features/visualizer/components/lens-panel";
import { PhasePipeline, ActivePhaseIndicator } from "@/features/visualizer/components/phase-pipeline";
import { cn } from "@/lib/utils";
import type {
  CallStackFrame,
  ClosureCapture,
  ExecutionStep,
  HoistedBindingView,
  QueueItem,
  ScopeBinding,
  ScopeBindingKind,
  ThisBinding,
  ThisBindingKind,
} from "@/types/execution";

interface RuntimeDashboardProps {
  step?: ExecutionStep;
  frames: CallStackFrame[];
  isRunning?: boolean;
  currentStepPanelCollapsed?: boolean;
  onCurrentStepPanelCollapsedChange?: (collapsed: boolean) => void;
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
      <div className="bg-muted/40 flex min-h-[44px] min-w-[4rem] items-center gap-1.5 overflow-x-auto rounded-lg border border-border/40 px-2 py-1.5">
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

const KIND_LABEL: Record<ScopeBindingKind, string> = {
  let: "let",
  const: "const",
  var: "var",
  param: "param",
};

const THIS_KIND_LABEL: Record<ThisBindingKind, string> = {
  method: "method call",
  "strict-undefined": "strict / unbound",
  "lexical-arrow": "lexical arrow",
  global: "global object",
};

function ThisBindingChip({ binding }: { binding: ThisBinding }) {
  const detail =
    binding.kind === "lexical-arrow" && binding.lexicalFrom
      ? ` — inherited from ${binding.lexicalFrom}`
      : "";

  return (
    <div className="mb-2 space-y-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-2">
      <p className="text-[10px] font-sans font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
        this binding
      </p>
      <p className="font-mono text-sm">
        <span className="text-primary">this</span>
        <span className="text-muted-foreground"> = </span>
        <span>{binding.value}</span>
      </p>
      <p className="text-muted-foreground text-xs">
        {THIS_KIND_LABEL[binding.kind]}
        {detail}
      </p>
    </div>
  );
}

function HoistingOverlay({ hoisting }: { hoisting: HoistedBindingView[] }) {
  return (
    <div className="mb-2 space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-2">
      <p className="text-[10px] font-sans font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Hoisted before execution
      </p>
      <ul className="space-y-1 font-mono text-sm">
        {hoisting.map((binding) => (
          <li key={`${binding.kind}:${binding.name}:${binding.declarationLine}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-muted-foreground text-[10px] font-sans uppercase tracking-wide">
              {binding.kind}
            </span>
            <span className="text-primary">{binding.name}</span>
            <span className="text-muted-foreground">→</span>
            <span>{binding.hoistedValue}</span>
            <span className="text-muted-foreground text-xs">(decl L{binding.declarationLine})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClosureCaptureList({ captures }: { captures: ClosureCapture[] }) {
  return (
    <div className="mb-2 space-y-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-2">
      <p className="text-[10px] font-sans font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        Captured from outer scope
      </p>
      <ul className="space-y-1 font-mono text-sm">
        {captures.map((capture) => (
          <li
            key={capture.name}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border border-border/30 bg-muted/25 px-2 py-1"
          >
            <span className="text-muted-foreground text-[10px] font-sans uppercase tracking-wide">
              {KIND_LABEL[capture.kind]}
            </span>
            <span className="text-primary">{capture.name}</span>
            <span className="text-muted-foreground">=</span>
            <span className="truncate">{capture.value}</span>
            <span className="text-muted-foreground text-xs">from {capture.fromFrame}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScopePanel({
  step,
  frames,
}: {
  step?: ExecutionStep;
  frames: CallStackFrame[];
}) {
  const topFrame = frames.at(-1);
  const [selectedFrameId, setSelectedFrameId] = useState<string | undefined>(undefined);
  const preferredFrameId = selectedFrameId ?? topFrame?.id;
  const activeFrameId =
    preferredFrameId && frames.some((frame) => frame.id === preferredFrameId)
      ? preferredFrameId
      : topFrame?.id;
  const activeFrame = frames.find((frame) => frame.id === activeFrameId);
  const bindings: ScopeBinding[] =
    activeFrameId && step?.scopes ? (step.scopes[activeFrameId] ?? []) : [];
  const closureCaptures: ClosureCapture[] =
    activeFrameId && step?.closureCaptures
      ? (step.closureCaptures[activeFrameId] ?? [])
      : [];
  const showHoisting = step?.phase === "hoisting" && (step.hoisting?.length ?? 0) > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {showHoisting && step?.hoisting ? <HoistingOverlay hoisting={step.hoisting} /> : null}

      {frames.length > 1 ? (
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="shrink-0 font-medium uppercase tracking-wide">Frame</span>
          <select
            value={activeFrameId ?? ""}
            onChange={(event) => setSelectedFrameId(event.target.value)}
            className="bg-background/80 min-w-0 flex-1 rounded-md border border-border/50 px-2 py-1 font-mono text-xs"
          >
            {[...frames].reverse().map((frame) => (
              <option key={frame.id} value={frame.id}>
                {frame.label}
                {frame.line ? `:${frame.line}` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {closureCaptures.length > 0 ? (
        <ClosureCaptureList captures={closureCaptures} />
      ) : null}

      {activeFrame?.thisBinding ? (
        <ThisBindingChip binding={activeFrame.thisBinding} />
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {bindings.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {activeFrame
              ? `No tracked variables in ${activeFrame.label}.`
              : "No variables in scope yet."}
          </p>
        ) : (
          <ul className="space-y-1 font-mono text-sm">
            {bindings.map((binding) => (
              <li
                key={binding.name}
                className="flex items-baseline gap-2 rounded-md border border-border/40 bg-muted/35 px-2 py-1"
              >
                <span className="text-muted-foreground shrink-0 text-[10px] font-sans uppercase tracking-wide">
                  {KIND_LABEL[binding.kind]}
                </span>
                <span className="text-primary shrink-0">{binding.name}</span>
                <span className="text-muted-foreground shrink-0">=</span>
                <span className="min-w-0 truncate">{binding.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Unified runtime view — stack, loop, queues, scope, APIs together. */
export function RuntimeDashboard({
  step,
  frames,
  isRunning = false,
  currentStepPanelCollapsed = false,
  onCurrentStepPanelCollapsedChange,
}: RuntimeDashboardProps) {
  const topDown = [...frames].reverse();
  const topFrame = frames.at(-1);
  const topScopeCount = topFrame?.id ? (step?.scopes?.[topFrame.id]?.length ?? 0) : 0;
  const duplicatedLabels = new Set(
    frames
      .map((frame) => frame.label)
      .filter((label, index, labels) => labels.indexOf(label) !== index),
  );

  const frameRole = (frame: CallStackFrame, index: number) => {
    if (!duplicatedLabels.has(frame.label)) return null;
    return index === 0 ? "function body" : "task callback";
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <LensPanel
        label="Current step"
        tooltip="What the runtime is doing right now — updates as you step through execution."
        accent="teal"
        className="shrink-0"
        collapsible
        collapsed={currentStepPanelCollapsed}
        onCollapsedChange={onCurrentStepPanelCollapsedChange}
        collapsedSummary={
          <>
            <span className="min-w-0 flex-1 truncate">
              {step?.label ?? "Run a snippet to begin stepping through execution."}
            </span>
            <ActivePhaseIndicator step={step} isRunning={isRunning} />
          </>
        }
      >
        <p className="mb-2 text-sm leading-snug">
          {step?.label ?? "Run a snippet to begin stepping through execution."}
        </p>
        <PhasePipeline step={step} isRunning={isRunning} />
      </LensPanel>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:grid-rows-[minmax(8rem,auto)_minmax(4.5rem,auto)_minmax(4.5rem,9rem)]">
      <LensPanel
        label="Call stack"
        hint={`${frames.length}`}
        tooltip="Active function frames. New calls animate in from the top; returns animate out upward. Top frame runs first (LIFO)."
        accent="amber"
        surface="recessed"
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
                    "rounded-lg border border-border/50 bg-muted/45 px-3 py-2 font-mono text-sm",
                    index === 0 && "border-primary/40 bg-primary/10 ring-1 ring-primary/20",
                  )}
                >
                  <span>{frame.label}</span>
                  {frame.line ? (
                    <span className="text-muted-foreground ml-2 opacity-70">:{frame.line}</span>
                  ) : null}
                  {frameRole(frame, index) ? (
                    <span className="text-muted-foreground ml-2 text-[10px] font-sans uppercase tracking-wide opacity-80">
                      {frameRole(frame, index)}
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
        surface="recessed"
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
        hint={`${topScopeCount}`}
        tooltip="Live let/const/var/param values, `this` binding, hoisting preview, and closure captures for the selected frame."
        accent="slate"
        surface="recessed"
        className="min-h-[4.5rem] lg:col-span-2 lg:row-start-2"
      >
        <ScopePanel step={step} frames={frames} />
      </LensPanel>

      <LensPanel
        label="Web APIs"
        hint={`${step?.webApi?.length ?? 0}`}
        tooltip="Browser/Node timers and I/O registered outside the JS thread — they enqueue macrotasks when done."
        accent="teal"
        surface="recessed"
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
