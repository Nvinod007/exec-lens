import type {
  CallStackFrame,
  ConsoleEntry,
  ExecutionStep,
  QueueItem,
  RunResult,
} from "@/types/execution";

import vm from "node:vm";

import {
  installAsyncInstrumentation,
  registerAsyncEnter,
  registerAsyncExit,
  restoreAsyncInstrumentation,
  buildAwaitLabel,
} from "@/lib/runner/async-instrumentation";
import {
  captureUserCallSite,
  createInstrumentedPromise,
  flushNativeMicrotasks,
  installPromiseInstrumentation,
  restorePromiseInstrumentation,
} from "@/lib/runner/promise-instrumentation";
import { instrumentUserSource } from "@/lib/runner/instrument-source";
import { hasActiveUserAsync } from "@/lib/runner/async-context";
import { runnerDebug } from "@/lib/runner/runner-debug";
import {
  collectDueTimers,
  findEarliestTimer,
  formatClockAdvanceLabel,
  formatMacrotaskLabel,
  formatRunLabel,
  formatScheduleLabel,
  formatTimerWebApiEntry,
  parseTimerDelay,
  type VirtualTimer,
} from "@/lib/runner/virtual-clock";

interface RunSnippetOptions {
  /** Pre-instrumented executable (e.g. esbuild output). Line numbers refer to `userSource`. */
  executable?: string;
}

/** Serialize snippet runs so global Promise/async hooks are not torn down mid-flight. */
let runTurn: Promise<void> = Promise.resolve();

function userLineCount(userSource: string): number {
  return userSource.split("\n").length;
}

function isValidUserLine(userSource: string, line: number | undefined): line is number {
  return line !== undefined && line >= 1 && line <= userLineCount(userSource);
}

/** Map a callback name back to a line in the editor source when stack capture fails. */
function resolveNamedSourceLine(userSource: string, name: string): number | undefined {
  if (
    !name ||
    name.startsWith("Promise.") ||
    name.includes("setTimeout callback") ||
    name.startsWith("() =>")
  ) {
    return undefined;
  }

  const patterns = [
    new RegExp(`function\\s+${name}\\b`),
    new RegExp(`\\.then\\(\\s*function\\s+${name}\\b`),
    new RegExp(`\\b${name}\\s*[:=]\\s*(?:async\\s+)?function\\b`),
    new RegExp(`\\b${name}\\s*[:=]\\s*(?:async\\s*)?\\(`),
  ];

  const lines = userSource.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (patterns.some((pattern) => pattern.test(lines[index]!))) {
      return index + 1;
    }
  }

  return undefined;
}

function resolveSetTimeoutCallSite(userSource: string, handlerName: string): number | undefined {
  const escaped = handlerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = handlerName
    ? [
        new RegExp(`setTimeout\\(\\s*${escaped}\\b`),
        new RegExp(`setTimeout\\(\\s*function\\s+${escaped}\\b`),
        new RegExp(`setTimeout\\([^)]*resolve\\(['"]${escaped}['"]\\)`),
      ]
    : [new RegExp(`setTimeout\\(\\s*\\(`)];

  const lines = userSource.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (patterns.some((pattern) => pattern.test(lines[index]!))) return index + 1;
  }
  return undefined;
}

function resolveThenCallSite(userSource: string, handlerName: string): number | undefined {
  const pattern = new RegExp(`\\.then\\(\\s*${handlerName}\\b`);
  const lines = userSource.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index]!)) return index + 1;
  }
  return undefined;
}

function resolveNewPromiseLine(userSource: string): number | undefined {
  const index = userSource.split("\n").findIndex((line) => /\bnew\s+Promise\s*\(/.test(line));
  return index >= 0 ? index + 1 : undefined;
}

type SourceLineMode = "call-site" | "handler-body";

function resolveSourceLine(
  userSource: string,
  capturedLine: number | undefined,
  mode: SourceLineMode,
  ...nameHints: string[]
): number | undefined {
  for (const name of nameHints) {
    if (mode === "call-site") {
      const setTimeoutLine = resolveSetTimeoutCallSite(userSource, name);
      if (setTimeoutLine !== undefined) return setTimeoutLine;
      const thenLine = resolveThenCallSite(userSource, name);
      if (thenLine !== undefined) return thenLine;
    }

    const namedLine = resolveNamedSourceLine(userSource, name);
    if (namedLine !== undefined) return namedLine;
  }

  if (isValidUserLine(userSource, capturedLine)) return capturedLine;

  return undefined;
}

function findLastActiveLine(ctx: RunnerContext): number | undefined {
  for (let index = ctx.steps.length - 1; index >= 0; index -= 1) {
    const line = ctx.steps[index]?.activeLine;
    if (line !== undefined) return line;
  }
  return undefined;
}

function getSetTimeoutLabel(callback: () => void): string {
  if (callback.name) return callback.name;

  const source = Function.prototype.toString.call(callback).replace(/\s+/g, " ").trim();
  if (source.includes("[native code]")) return "setTimeout callback";

  const resolveMatch = source.match(/resolve\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (resolveMatch?.[1]) return resolveMatch[1];

  if (source.startsWith("() =>") || source.startsWith("function")) {
    return source.length <= 40 ? source : `${source.slice(0, 37)}...`;
  }

  return "setTimeout callback";
}

interface PendingTask {
  id: string;
  label: string;
  run: () => void;
  sourceLine?: number;
  /** Logical delay from setTimeout — shown in step labels. */
  delay?: number;
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
  /** Timers waiting in the Web API until virtual time reaches fireAt. */
  timers: VirtualTimer[];
  /** Simulated runtime clock in milliseconds. */
  virtualTime: number;
  /** Microtasks shown in the UI — includes native Promise + await continuations. */
  microtaskDisplay: QueueItem[];
  taskCounter: number;
  logCounter: number;
  /** When true, promise/async hooks stop recording steps. */
  recordingComplete: boolean;
  userSource: string;
  runStartedAt: number;
  maxSteps: number;
  wallTimeoutMs: number;
}

function readRunnerLimits() {
  const maxSteps = Number.parseInt(process.env.MAX_RUNNER_STEPS ?? "5000", 10);
  const wallTimeoutMs = Number.parseInt(process.env.RUNNER_TIMEOUT_MS ?? "10000", 10);
  return {
    maxSteps: Number.isFinite(maxSteps) && maxSteps > 0 ? maxSteps : 5000,
    wallTimeoutMs: Number.isFinite(wallTimeoutMs) && wallTimeoutMs > 0 ? wallTimeoutMs : 10000,
  };
}

function assertWithinRunLimits(ctx: RunnerContext) {
  if (ctx.steps.length >= ctx.maxSteps) {
    throw new Error(`Run exceeded the ${ctx.maxSteps} step limit.`);
  }
  if (Date.now() - ctx.runStartedAt > ctx.wallTimeoutMs) {
    throw new Error(`Run exceeded the ${ctx.wallTimeoutMs}ms wall-time limit.`);
  }
}

function syncWebApiView(ctx: RunnerContext) {
  ctx.webApi = ctx.timers.map(formatTimerWebApiEntry);
}

function popSyncFrame(ctx: RunnerContext, name: string) {
  const index = ctx.callStack.findLastIndex(
    (frame) => frame.label === name && !frame.async,
  );
  if (index >= 0) {
    ctx.callStack.splice(index, 1);
  }
}

function dequeueAwaitContinuation(ctx: RunnerContext, awaitLabel: string) {
  const resumeLabel = `Resume after ${awaitLabel}`;
  const index = ctx.microtaskDisplay.findIndex((item) => item.label === resumeLabel);
  if (index >= 0) {
    ctx.microtaskDisplay.splice(index, 1);
    syncQueueViews(ctx);
    runnerDebug.log("await continuation dequeued", { resumeLabel });
  }
}

function resumeAsyncIfSuspended(ctx: RunnerContext, source: string) {
  const frame = findTopAsyncFrame(ctx);
  if (!frame?.suspended) return;

  const awaitingMatch = frame.label.match(/\(awaiting (.+)\)$/);
  const awaitLabel = awaitingMatch ? `await ${awaitingMatch[1]}` : "await …";
  dequeueAwaitContinuation(ctx, awaitLabel);
  recordAwaitResume(ctx, source);
}

function recordConsoleLog(ctx: RunnerContext, line: number, values: unknown[]) {
  resumeAsyncIfSuspended(ctx, ctx.userSource);

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

/** Clone queue snapshots so steps remain immutable. */
function snapshot(ctx: RunnerContext, partial: Partial<ExecutionStep>): ExecutionStep {
  assertWithinRunLimits(ctx);

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
  ctx.microtaskQueue = ctx.microtaskDisplay.map((item) => ({ ...item }));
  ctx.macrotaskQueue = ctx.pendingMacro.map((task) => ({
    id: task.id,
    label: formatMacrotaskLabel(task.label, task.delay ?? 0),
    sourceLine: task.sourceLine,
    kind: "macrotask" as const,
  }));
}

/** Clear live runtime views before terminal complete/error snapshots. */
function finalizeTerminalSnapshot(ctx: RunnerContext) {
  ctx.recordingComplete = true;
  ctx.callStack.length = 0;
  ctx.microtaskDisplay.length = 0;
  ctx.pendingMacro.length = 0;
  ctx.timers.length = 0;
  syncWebApiView(ctx);
  syncQueueViews(ctx);
}

function findLastAwaitLine(ctx: RunnerContext): number | undefined {
  for (let index = ctx.steps.length - 1; index >= 0; index -= 1) {
    const step = ctx.steps[index];
    if (step?.phase === "await-suspend" && step.activeLine !== undefined) {
      return step.activeLine;
    }
  }
  return undefined;
}

function scheduleMicrotaskDisplay(
  ctx: RunnerContext,
  label: string,
  sourceLine?: number,
): string {
  const id = createTaskId(ctx);
  ctx.microtaskDisplay.push({
    id,
    label,
    sourceLine,
    kind: "microtask",
  });
  syncQueueViews(ctx);
  runnerDebug.log("microtask scheduled", {
    label,
    sourceLine,
    queueSize: ctx.microtaskDisplay.length,
  });
  return id;
}

function dequeueMicrotaskDisplay(ctx: RunnerContext, label: string) {
  const index = ctx.microtaskDisplay.findIndex((item) => item.label === label);
  if (index >= 0) {
    ctx.microtaskDisplay.splice(index, 1);
  } else if (ctx.microtaskDisplay.length > 0) {
    ctx.microtaskDisplay.shift();
  }
  syncQueueViews(ctx);
  runnerDebug.log("microtask dequeued", {
    label,
    queueSize: ctx.microtaskDisplay.length,
  });
}

function pushFrame(
  ctx: RunnerContext,
  label: string,
  line?: number,
  options?: Pick<CallStackFrame, "async" | "suspended">,
) {
  const duplicate = ctx.callStack.some(
    (frame) =>
      frame.label.replace(/\s+\(awaiting .*\)$/, "") ===
        label.replace(/\s+\(awaiting .*\)$/, "") &&
      frame.line === line &&
      Boolean(frame.async) === Boolean(options?.async),
  );
  if (duplicate) return;

  ctx.callStack.push({
    id: createTaskId(ctx),
    label,
    line,
    async: options?.async,
    suspended: options?.suspended,
  });
}

function findTopAsyncFrame(ctx: RunnerContext): CallStackFrame | undefined {
  for (let index = ctx.callStack.length - 1; index >= 0; index -= 1) {
    if (ctx.callStack[index]?.async) return ctx.callStack[index];
  }
  return undefined;
}

function markAsyncSuspended(ctx: RunnerContext, awaitLabel: string) {
  const frame = findTopAsyncFrame(ctx);
  if (!frame) return;

  frame.suspended = true;
  const awaitingText = awaitLabel.startsWith("await ")
    ? awaitLabel.slice(6)
    : awaitLabel;
  const baseLabel = frame.label.replace(/\s+\(awaiting .*\)$/, "");
  frame.label = `${baseLabel} (awaiting ${awaitingText})`;
}

function clearAsyncSuspended(ctx: RunnerContext) {
  const frame = findTopAsyncFrame(ctx);
  if (!frame) return;

  frame.suspended = false;
  frame.label = frame.label.replace(/\s+\(awaiting .*\)$/, "");
}

function popFrame(ctx: RunnerContext) {
  ctx.callStack.pop();
}

function popGlobalFrame(ctx: RunnerContext) {
  const index = ctx.callStack.findLastIndex(
    (frame) => frame.label === "Global" && !frame.async,
  );
  if (index >= 0) {
    ctx.callStack.splice(index, 1);
  }
}

function enqueueMicrotask(
  ctx: RunnerContext,
  label: string,
  run: () => void,
  sourceLine?: number,
) {
  const id = scheduleMicrotaskDisplay(ctx, label, sourceLine);
  ctx.pendingMicro.push({
    id,
    label,
    run,
    sourceLine,
  });
  snapshot(ctx, {
    phase: "schedule-microtask",
    label: `Enqueued microtask: ${label}`,
    activeLine: sourceLine,
  });
}

function runMicrotask(
  ctx: RunnerContext,
  label: string,
  run: () => void,
  sourceLine?: number,
) {
  dequeueMicrotaskDisplay(ctx, label);
  pushFrame(ctx, label, sourceLine);
  snapshot(ctx, {
    phase: "run-microtask",
    label: `Running microtask: ${label}`,
    activeLine: sourceLine,
  });
  run();
  popFrame(ctx);
}

function registerTimer(
  ctx: RunnerContext,
  label: string,
  callback: () => void,
  delay: number,
  sourceLine?: number,
): string {
  const id = createTaskId(ctx);
  const timer: VirtualTimer = {
    id,
    label,
    callback,
    delay,
    scheduledAt: ctx.virtualTime,
    fireAt: ctx.virtualTime + delay,
    sourceLine,
  };
  ctx.timers.push(timer);
  syncWebApiView(ctx);
  syncQueueViews(ctx);
  snapshot(ctx, {
    phase: "schedule-macrotask",
    label: formatScheduleLabel(label, delay),
    activeLine: sourceLine,
  });
  return id;
}

function promoteDueTimers(ctx: RunnerContext) {
  const { due, pending } = collectDueTimers(ctx.timers, ctx.virtualTime);
  if (due.length === 0) return;

  ctx.timers = pending;
  syncWebApiView(ctx);

  for (const timer of due) {
    ctx.pendingMacro.push({
      id: timer.id,
      label: timer.label,
      run: timer.callback,
      sourceLine: timer.sourceLine,
      delay: timer.delay,
    });
  }
  syncQueueViews(ctx);
}

function advanceVirtualClock(ctx: RunnerContext): boolean {
  const next = findEarliestTimer(ctx.timers);
  if (!next) return false;

  ctx.virtualTime = next.fireAt;
  snapshot(ctx, {
    phase: "event-loop-tick",
    label: formatClockAdvanceLabel(ctx.virtualTime),
  });
  return true;
}

function drainMicrotasks(ctx: RunnerContext) {
  while (ctx.pendingMicro.length > 0) {
    const task = ctx.pendingMicro.shift()!;
    runMicrotask(ctx, task.label, task.run, task.sourceLine);
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

  const displayLabel = formatMacrotaskLabel(task.label, task.delay ?? 0);
  pushFrame(ctx, displayLabel, task.sourceLine);
  snapshot(ctx, {
    phase: "run-macrotask",
    label: formatRunLabel(task.label, task.delay ?? 0),
    activeLine: task.sourceLine,
  });
  task.run();
  popFrame(ctx);
  return true;
}

async function driveEventLoop(ctx: RunnerContext): Promise<void> {
  assertWithinRunLimits(ctx);
  await flushNativeMicrotasks();
  drainMicrotasks(ctx);
  promoteDueTimers(ctx);

  while (ctx.timers.length > 0 || ctx.pendingMacro.length > 0) {
    assertWithinRunLimits(ctx);

    while (ctx.pendingMacro.length > 0) {
      runNextMacrotask(ctx);
      await flushNativeMicrotasks();
      drainMicrotasks(ctx);
      promoteDueTimers(ctx);
    }

    if (ctx.timers.length > 0) {
      advanceVirtualClock(ctx);
      promoteDueTimers(ctx);
    } else {
      break;
    }
  }

  if (
    ctx.timers.length === 0 &&
    ctx.pendingMacro.length === 0 &&
    ctx.pendingMicro.length === 0
  ) {
    ctx.recordingComplete = true;
  }
  await flushNativeMicrotasks();
  drainMicrotasks(ctx);
}

function recordAwaitSuspend(ctx: RunnerContext, source: string, line: number) {
  resumeAsyncIfSuspended(ctx, source);

  const awaitLabel = buildAwaitLabel(source, line);
  scheduleMicrotaskDisplay(ctx, `Resume after ${awaitLabel}`, line);
  markAsyncSuspended(ctx, awaitLabel);
  snapshot(ctx, {
    phase: "await-suspend",
    label: `Paused at ${awaitLabel}`,
    activeLine: line,
  });
  runnerDebug.log("await suspend", { line, awaitLabel });
}

function recordAwaitResume(ctx: RunnerContext, source: string) {
  const frame = findTopAsyncFrame(ctx);
  const awaitingMatch = frame?.label.match(/\(awaiting (.+)\)$/);
  const awaitLabel = awaitingMatch ? `await ${awaitingMatch[1]}` : "await …";
  const resumeLine = findLastAwaitLine(ctx);
  clearAsyncSuspended(ctx);
  snapshot(ctx, {
    phase: "await-resume",
    label: `Resumed after ${awaitLabel}`,
    activeLine: resumeLine,
  });
  runnerDebug.log("await resume", { line: resumeLine, awaitLabel });
}

function createAsyncHooks(ctx: RunnerContext) {
  return {
    onAsyncEnter: (name: string, line: number | undefined) => {
      pushFrame(ctx, name, line, { async: true });
      snapshot(ctx, {
        phase: "run-sync",
        label: `Enter async function ${name}`,
        activeLine: line,
      });
    },
    onAwaitSuspend: (_label: string, _line: number | undefined) => {
      /* await suspend/resume snapshots come from promise instrumentation */
    },
    onAwaitResume: (_label: string, _line: number | undefined) => {
      /* await suspend/resume snapshots come from promise instrumentation */
    },
    onAsyncExit: (name: string) => {
      const frame = findTopAsyncFrame(ctx);
      const baseLabel = frame?.label.replace(/\s+\(awaiting .*\)$/, "");
      if (baseLabel === name) {
        popFrame(ctx);
      }
    },
  };
}

function isInternalFallbackLabel(label: string): boolean {
  return /^Promise\.then\(#\d+\)$/.test(label);
}

function createPromiseHooks(ctx: RunnerContext, source: string) {
  return {
    onScheduleMicrotask: (label: string, sourceLine?: number, options?: { queueDisplay?: boolean; displayOnly?: boolean }) => {
      if (ctx.recordingComplete || isInternalFallbackLabel(label)) return;

      const suspendedAsync = hasActiveUserAsync() && findTopAsyncFrame(ctx)?.suspended;
      if (
        !options?.displayOnly &&
        suspendedAsync &&
        ctx.microtaskDisplay.some((item) => item.label.startsWith("Resume after "))
      ) {
        runnerDebug.log("promise schedule (await continuation, display unchanged)", { label });
        return;
      }

      const line = resolveSourceLine(source, sourceLine, "call-site", label);
      if (options?.queueDisplay !== false) {
        scheduleMicrotaskDisplay(ctx, label, line);
      }
      if (options?.displayOnly) return;

      runnerDebug.log("promise schedule", { label, sourceLine: line, async: hasActiveUserAsync() });
      snapshot(ctx, {
        phase: "schedule-microtask",
        label: `Enqueued microtask: ${label}`,
        activeLine: line,
      });
    },
    onRunMicrotask: (label: string, sourceLine: number | undefined, run: () => void) => {
      if (isInternalFallbackLabel(label)) {
        run();
        return;
      }
      if (ctx.recordingComplete) {
        run();
        return;
      }

      const line = resolveSourceLine(source, sourceLine, "call-site", label);
      resumeAsyncIfSuspended(ctx, source);
      runMicrotask(ctx, label, run, line);
    },
    onPromiseExecutor: (
      label: string,
      sourceLine: number | undefined,
      run: () => void,
    ) => {
      const line =
        (isValidUserLine(source, sourceLine) ? sourceLine : undefined) ??
        resolveNewPromiseLine(source);
      pushFrame(ctx, label, line);
      snapshot(ctx, {
        phase: "run-sync",
        label: "Running Promise executor",
        activeLine: line,
      });
      run();
      popFrame(ctx);
    },
  };
}

/** Build the sandbox globals exposed to user snippets. */
function createSandbox(
  ctx: RunnerContext,
  PromiseCtor: typeof Promise,
  userSource: string,
  sourceLineOffset: number,
) {
  return {
    console: {
      log: (...values: unknown[]) => {
        recordConsoleLog(ctx, 1, values);
      },
    },
    __consoleLog: (line: number, ...values: unknown[]) => {
      recordConsoleLog(ctx, line, values);
    },
    __execLensAsyncEnter: (name: string, line: number) => {
      registerAsyncEnter(name, line);
    },
    __execLensAsyncExit: (name: string) => {
      registerAsyncExit(name);
    },
    __execLensSyncEnter: (name: string, line: number) => {
      pushFrame(ctx, name, line);
      snapshot(ctx, {
        phase: "run-sync",
        label: `Enter function ${name}`,
        activeLine: line,
      });
      runnerDebug.log("sync enter", { name, line });
    },
    __execLensSyncExit: (name: string) => {
      popSyncFrame(ctx, name);
      runnerDebug.log("sync exit", { name });
    },
    __execLensAwaitWrap: (line: number, value: unknown) => {
      recordAwaitSuspend(ctx, userSource, line);
      return value;
    },
    setTimeout: (callback: () => void, delay?: number) => {
      const parsedDelay = parseTimerDelay(delay);
      const label = getSetTimeoutLabel(callback);
      const sourceLine = resolveSourceLine(
        userSource,
        captureUserCallSite(sourceLineOffset),
        "call-site",
        label,
      );
      return registerTimer(ctx, label, callback, parsedDelay, sourceLine);
    },
    setInterval: () => {
      throw new Error("setInterval is not supported in ExecLens.");
    },
    Promise: PromiseCtor,
    queueMicrotask: (callback: () => void) => {
      const label = callback.name || "queueMicrotask callback";
      enqueueMicrotask(ctx, label, callback);
    },
  };
}

/**
 * Execute a JS snippet with native Promise instrumentation and record event-loop steps.
 * Pass `executable` when TypeScript was compiled after instrumenting the editor source.
 */
export async function runJavaScriptSnippet(
  userSource: string,
  options: RunSnippetOptions = {},
): Promise<RunResult> {
  const priorTurn = runTurn;
  let releaseTurn!: () => void;
  runTurn = new Promise<void>((resolve) => {
    releaseTurn = resolve;
  });
  await priorTurn;

  try {
    return await executeJavaScriptSnippet(userSource, options);
  } finally {
    releaseTurn();
  }
}

async function executeJavaScriptSnippet(
  userSource: string,
  options: RunSnippetOptions = {},
): Promise<RunResult> {
  const instrumented = options.executable ?? instrumentUserSource(userSource);
  const limits = readRunnerLimits();
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
    timers: [],
    virtualTime: 0,
    microtaskDisplay: [],
    taskCounter: 0,
    logCounter: 0,
    recordingComplete: false,
    userSource,
    runStartedAt: Date.now(),
    maxSteps: limits.maxSteps,
    wallTimeoutMs: limits.wallTimeoutMs,
  };

  const sourceLineOffset = 1;
  const promiseHooks = createPromiseHooks(ctx, userSource);
  const asyncHooks = createAsyncHooks(ctx);
  let runtimeError: string | undefined;

  const onUnhandledRejection = (reason: unknown) => {
    runtimeError =
      reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection");
  };

  process.on("unhandledRejection", onUnhandledRejection);

  try {
    installPromiseInstrumentation(promiseHooks, sourceLineOffset);
    installAsyncInstrumentation(asyncHooks, userSource, sourceLineOffset);

    const InstrumentedPromise = createInstrumentedPromise(
      Promise,
      promiseHooks,
      sourceLineOffset,
    );
    const sandbox = createSandbox(ctx, InstrumentedPromise, userSource, sourceLineOffset);

    snapshot(ctx, {
      phase: "evaluate-script",
      label: "Evaluate script — global execution context created",
      activeLine: 1,
    });

    pushFrame(ctx, "Global", 1);
    const vmSandbox = {
      __consoleLog: sandbox.__consoleLog,
      __execLensAsyncEnter: sandbox.__execLensAsyncEnter,
      __execLensAsyncExit: sandbox.__execLensAsyncExit,
      __execLensSyncEnter: sandbox.__execLensSyncEnter,
      __execLensSyncExit: sandbox.__execLensSyncExit,
      __execLensAwaitWrap: sandbox.__execLensAwaitWrap,
      console: sandbox.console,
      setTimeout: sandbox.setTimeout,
      setInterval: sandbox.setInterval,
      Promise: sandbox.Promise,
      queueMicrotask: sandbox.queueMicrotask,
    };

    snapshot(ctx, {
      phase: "run-sync",
      label: "Running synchronous code on the call stack",
      activeLine: 1,
    });

    vm.runInNewContext(`"use strict";\n${instrumented}`, vmSandbox, {
      timeout: ctx.wallTimeoutMs,
      filename: "exec-lens-snippet.js",
    });

    popGlobalFrame(ctx);

    await driveEventLoop(ctx);

    if (runtimeError) {
      const errorLine = findLastAwaitLine(ctx);
      finalizeTerminalSnapshot(ctx);
      snapshot(ctx, {
        phase: "error",
        label: `Unhandled rejection: ${runtimeError}`,
        activeLine: errorLine,
      });
      return {
        steps: ctx.steps,
        error: runtimeError,
        errorLine,
        language: "javascript",
      };
    }

    finalizeTerminalSnapshot(ctx);

    snapshot(ctx, {
      phase: "complete",
      label: "Execution complete — call stack empty",
      activeLine: findLastActiveLine(ctx),
    });

    return { steps: ctx.steps, language: "javascript" };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown runtime error";
    const message = rawMessage.includes("Script execution timed out")
      ? `Run exceeded the ${ctx.wallTimeoutMs}ms wall-time limit.`
      : rawMessage;
    finalizeTerminalSnapshot(ctx);
    snapshot(ctx, {
      phase: "error",
      label: `Runtime error: ${message}`,
    });
    return {
      steps: ctx.steps,
      error: message,
      language: "javascript",
    };
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    restoreAsyncInstrumentation();
    restorePromiseInstrumentation();
  }
}
