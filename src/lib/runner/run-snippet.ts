import type {
  CallStackFrame,
  ConsoleEntry,
  ExecutionStep,
  QueueItem,
  RunResult,
} from "@/types/execution";

import { SandboxPromise } from "@/lib/runner/sandbox-promise";

interface PendingTask {
  id: string;
  label: string;
  run: () => void;
  sourceLine?: number;
}

interface RunnerContext {
  callStack: CallStackFrame[];
  microtaskQueue: QueueItem[];
  macrotaskQueue: QueueItem[];
  webApi: string[];
  consoleLog: ConsoleEntry[];
  steps: ExecutionStep[];
  stepCounter: number;
  pendingMicro: PendingTask[];
  pendingMacro: PendingTask[];
  taskCounter: number;
  lineMap: Map<string, number>;
  logCounter: number;
}

/** Tag each console.log call with its source line for accurate output attribution. */
function instrumentConsoleLogs(source: string): string {
  return source
    .split("\n")
    .map((line, index) =>
      line.replace(/console\.log\s*\(/g, () => `__consoleLog(${index + 1}, `),
    )
    .join("\n");
}

function recordConsoleLog(ctx: RunnerContext, line: number, values: unknown[]) {
  ctx.logCounter += 1;

  ctx.consoleLog.push({
    id: createTaskId(ctx),
    values: values.map(String),
    line,
    timestamp: Date.now(),
    index: ctx.logCounter,
  });
  snapshot(ctx, {
    phase: "console",
    label: `console.log(${values.map(String).join(", ")})`,
    activeLine: line,
  });
}

/** Build a stable line map from user source for runtime attribution. */
function buildLineMap(source: string): Map<string, number> {
  const map = new Map<string, number>();
  source.split("\n").forEach((line, index) => {
    const fnMatch = line.match(/function\s+(\w+)/);
    if (fnMatch) map.set(fnMatch[1], index + 1);
    if (line.includes("setTimeout")) map.set("setTimeout", index + 1);
    if (line.includes("Promise")) map.set("Promise", index + 1);
    if (line.includes("console.log")) map.set("console.log", index + 1);
    if (line.includes("queueMicrotask")) map.set("queueMicrotask", index + 1);
  });
  return map;
}

/** Clone queue snapshots so steps remain immutable. */
function snapshot(ctx: RunnerContext, partial: Partial<ExecutionStep>): ExecutionStep {
  const step: ExecutionStep = {
    id: ctx.stepCounter++,
    phase: partial.phase ?? "run-sync",
    label: partial.label ?? "",
    activeLine: partial.activeLine,
    callStack: ctx.callStack.map((frame) => ({ ...frame })),
    microtaskQueue: ctx.microtaskQueue.map((item) => ({ ...item })),
    macrotaskQueue: ctx.macrotaskQueue.map((item) => ({ ...item })),
    console: [...ctx.consoleLog],
    webApi: [...ctx.webApi],
  };
  ctx.steps.push(step);
  return step;
}

function createTaskId(ctx: RunnerContext): string {
  ctx.taskCounter += 1;
  return `task-${ctx.taskCounter}`;
}

function syncQueueViews(ctx: RunnerContext) {
  ctx.microtaskQueue = ctx.pendingMicro.map((task) => ({
    id: task.id,
    label: task.label,
    sourceLine: task.sourceLine,
    kind: "microtask" as const,
  }));
  ctx.macrotaskQueue = ctx.pendingMacro.map((task) => ({
    id: task.id,
    label: task.label,
    sourceLine: task.sourceLine,
    kind: "macrotask" as const,
  }));
}

function pushFrame(ctx: RunnerContext, label: string, line?: number) {
  ctx.callStack.push({ id: createTaskId(ctx), label, line });
}

function popFrame(ctx: RunnerContext) {
  ctx.callStack.pop();
}

function enqueueMicrotask(
  ctx: RunnerContext,
  label: string,
  run: () => void,
  sourceLine?: number,
) {
  ctx.pendingMicro.push({
    id: createTaskId(ctx),
    label,
    run,
    sourceLine,
  });
  syncQueueViews(ctx);
  snapshot(ctx, {
    phase: "schedule-microtask",
    label: `Enqueued microtask: ${label}`,
    activeLine: sourceLine,
  });
}

function enqueueMacrotask(
  ctx: RunnerContext,
  label: string,
  run: () => void,
  sourceLine?: number,
) {
  ctx.pendingMacro.push({
    id: createTaskId(ctx),
    label,
    run,
    sourceLine,
  });
  ctx.webApi.push(`${label} → Web API timer`);
  syncQueueViews(ctx);
  snapshot(ctx, {
    phase: "schedule-macrotask",
    label: `Scheduled macrotask: ${label}`,
    activeLine: sourceLine,
  });
}

function drainMicrotasks(ctx: RunnerContext) {
  while (ctx.pendingMicro.length > 0) {
    const task = ctx.pendingMicro.shift()!;
    syncQueueViews(ctx);
    pushFrame(ctx, task.label, task.sourceLine);
    snapshot(ctx, {
      phase: "run-microtask",
      label: `Running microtask: ${task.label}`,
      activeLine: task.sourceLine,
    });
    task.run();
    popFrame(ctx);
  }
}

function runNextMacrotask(ctx: RunnerContext): boolean {
  const task = ctx.pendingMacro.shift();
  if (!task) return false;

  syncQueueViews(ctx);
  snapshot(ctx, {
    phase: "event-loop-tick",
    label: "Event loop picks next macrotask",
    activeLine: task.sourceLine,
  });

  pushFrame(ctx, task.label, task.sourceLine);
  snapshot(ctx, {
    phase: "run-macrotask",
    label: `Running macrotask: ${task.label}`,
    activeLine: task.sourceLine,
  });
  task.run();
  popFrame(ctx);
  return true;
}

/** Build the sandbox globals exposed to user snippets. */
function createSandbox(ctx: RunnerContext) {
  const bridge = {
    lineMap: ctx.lineMap,
    enqueueMicrotask: (label: string, run: () => void, sourceLine?: number) =>
      enqueueMicrotask(ctx, label, run, sourceLine),
  };

  return {
    console: {
      log: (...values: unknown[]) => {
        recordConsoleLog(ctx, ctx.lineMap.get("console.log") ?? 1, values);
      },
    },
    __consoleLog: (line: number, ...values: unknown[]) => {
      recordConsoleLog(ctx, line, values);
    },
    setTimeout: (callback: () => void, _delay?: number) => {
      const line = ctx.lineMap.get("setTimeout");
      enqueueMacrotask(ctx, callback.name || "setTimeout callback", callback, line);
      return createTaskId(ctx);
    },
    Promise: {
      resolve: (value: unknown) => SandboxPromise.resolve(bridge, value),
    },
    queueMicrotask: (callback: () => void) => {
      const line = ctx.lineMap.get("queueMicrotask");
      enqueueMicrotask(
        ctx,
        callback.name || "queueMicrotask callback",
        callback,
        line,
      );
    },
  };
}

/**
 * Execute a JS snippet inside a sandbox and record event-loop steps.
 * Patched timers and Promises produce deterministic queue visualization.
 */
export async function runJavaScriptSnippet(source: string): Promise<RunResult> {
  const instrumented = instrumentConsoleLogs(source);
  const ctx: RunnerContext = {
    callStack: [],
    microtaskQueue: [],
    macrotaskQueue: [],
    webApi: [],
    consoleLog: [],
    steps: [],
    stepCounter: 0,
    pendingMicro: [],
    pendingMacro: [],
    taskCounter: 0,
    lineMap: buildLineMap(source),
    logCounter: 0,
  };

  const sandbox = createSandbox(ctx);

  snapshot(ctx, {
    phase: "evaluate-script",
    label: "Evaluate script — global execution context created",
    activeLine: 1,
  });

  pushFrame(ctx, "Global", 1);

  try {
    const runner = new Function(
      "__consoleLog",
      "console",
      "setTimeout",
      "Promise",
      "queueMicrotask",
      `"use strict";\n${instrumented}`,
    );

    snapshot(ctx, {
      phase: "run-sync",
      label: "Running synchronous code on the call stack",
      activeLine: 1,
    });

    runner(
      sandbox.__consoleLog,
      sandbox.console,
      sandbox.setTimeout,
      sandbox.Promise,
      sandbox.queueMicrotask,
    );

    popFrame(ctx);

    while (ctx.pendingMicro.length > 0 || ctx.pendingMacro.length > 0) {
      drainMicrotasks(ctx);
      if (!runNextMacrotask(ctx)) break;
    }

    drainMicrotasks(ctx);

    snapshot(ctx, {
      phase: "complete",
      label: "Execution complete — call stack empty",
    });

    return { steps: ctx.steps, language: "javascript" };
  } catch (error) {
    snapshot(ctx, {
      phase: "error",
      label: error instanceof Error ? error.message : "Unknown runtime error",
    });
    return {
      steps: ctx.steps,
      error: error instanceof Error ? error.message : "Unknown runtime error",
      language: "javascript",
    };
  }
}
