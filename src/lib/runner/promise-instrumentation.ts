import type { CallStackFrame, ExecutionStep } from "@/types/execution";

import type { SourceLineResolver } from "@/lib/ast/source-map";
import { hasActiveUserAsync, markThenPatchedExecution } from "@/lib/runner/async-context";

const MAX_LABEL_LENGTH = 60;
const TRUNCATION_SUFFIX = "...";
const INSTRUMENTATION_PREFIX = "__execLens";

export interface ScheduleMicrotaskOptions {
  /** When false, record the step but defer queue display until the promise settles. */
  queueDisplay?: boolean;
  /** When true, update the queue display without recording a schedule step. */
  displayOnly?: boolean;
}

export interface PromiseInstrumentationHooks {
  onScheduleMicrotask: (
    label: string,
    sourceLine?: number,
    options?: ScheduleMicrotaskOptions,
  ) => void;
  onRunMicrotask: (
    label: string,
    sourceLine: number | undefined,
    run: () => void,
  ) => void;
  onPromiseExecutor: (
    label: string,
    sourceLine: number | undefined,
    run: () => void,
  ) => void;
}

interface CallbackMeta {
  label: string;
  sourceLine?: number;
}

interface PromiseInstrumentationState {
  hooks: PromiseInstrumentationHooks;
  sourceLineResolver: SourceLineResolver;
  originals: {
    then: typeof Promise.prototype.then;
    catch: typeof Promise.prototype.catch;
    finally: typeof Promise.prototype.finally;
  };
  patched: boolean;
}

let activeState: PromiseInstrumentationState | null = null;
/** Suppresses instrumentation for engine-internal Promise chains (e.g. `.finally` plumbing). */
let internalPromiseDepth = 0;
const callbackMeta = new WeakMap<(...args: unknown[]) => unknown, CallbackMeta>();

interface InstrumentedPromiseMeta {
  settled: boolean;
  deferredSchedules: Array<{ label: string; sourceLine?: number }>;
}

const instrumentedPromiseMeta = new WeakMap<Promise<unknown>, InstrumentedPromiseMeta>();

function getInstrumentedPromiseMeta(promise: Promise<unknown>): InstrumentedPromiseMeta {
  let meta = instrumentedPromiseMeta.get(promise);
  if (!meta) {
    meta = { settled: false, deferredSchedules: [] };
    instrumentedPromiseMeta.set(promise, meta);
  }
  return meta;
}

function settleInstrumentedPromise(
  state: PromiseInstrumentationState,
  promise: Promise<unknown> | undefined,
) {
  if (!promise) return;
  markInstrumentedPromiseSettled(state, promise);
}

function markInstrumentedPromiseSettled(
  state: PromiseInstrumentationState,
  promise: Promise<unknown>,
) {
  const meta = instrumentedPromiseMeta.get(promise);
  if (!meta || meta.settled) return;

  meta.settled = true;
  for (const deferred of meta.deferredSchedules) {
    state.hooks.onScheduleMicrotask(deferred.label, deferred.sourceLine, {
      queueDisplay: true,
      displayOnly: true,
    });
  }
  meta.deferredSchedules.length = 0;
}

function scheduleInstrumentedMicrotask(
  state: PromiseInstrumentationState,
  promise: Promise<unknown>,
  label: string,
  sourceLine: number | undefined,
) {
  const meta = instrumentedPromiseMeta.get(promise);
  if (!meta || meta.settled) {
    state.hooks.onScheduleMicrotask(label, sourceLine, { queueDisplay: true });
    return;
  }

  meta.deferredSchedules.push({ label, sourceLine });
  state.hooks.onScheduleMicrotask(label, sourceLine, { queueDisplay: false });
}

/** Map eval `<anonymous>` line numbers back to editor source lines. */
export function toUserSourceLine(
  evalLine: number | undefined,
  sourceLineResolver: SourceLineResolver,
): number | undefined {
  return sourceLineResolver.fromEvalLine(evalLine);
}

function getRawStack(): string | undefined {
  const error = new Error();
  return error.stack;
}

/** Resolve the first user snippet frame from a stack trace. */
export function captureUserCallSite(
  sourceLineResolver: SourceLineResolver,
): number | undefined {
  const stack = getRawStack();
  if (!stack) return undefined;

  for (const frame of stack.split("\n").slice(1)) {
    if (
      frame.includes("promise-instrumentation") ||
      frame.includes("run-snippet") ||
      frame.includes("node:") ||
      frame.includes("node_modules")
    ) {
      continue;
    }

    const anonymousMatch = frame.match(/<anonymous>:(\d+):\d+/);
    if (anonymousMatch) {
      return sourceLineResolver.fromEvalLine(Number(anonymousMatch[1]));
    }

    const evalMatch = frame.match(/eval.*?:(\d+):\d+/);
    if (evalMatch) {
      return sourceLineResolver.fromEvalLine(Number(evalMatch[1]));
    }
  }

  return undefined;
}

function truncateLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) return label;
  return `${label.slice(0, MAX_LABEL_LENGTH - TRUNCATION_SUFFIX.length)}${TRUNCATION_SUFFIX}`;
}

function getHandlerLabel(
  handler: unknown,
  fallback: string,
): string {
  if (typeof handler !== "function") return fallback;

  const fn = handler as (...args: unknown[]) => unknown;
  if (fn.name && !fn.name.startsWith(INSTRUMENTATION_PREFIX)) {
    return fn.name;
  }

  let source = Function.prototype.toString.call(fn).replace(/\s+/g, " ").trim();
  if (source.includes("[native code]")) return fallback;
  if (source.startsWith("async ")) source = source.slice(6);
  if (source.length > MAX_LABEL_LENGTH) {
    return truncateLabel(source);
  }
  return source || fallback;
}

function shouldInstrumentPromiseCall(sourceLineResolver: SourceLineResolver): boolean {
  if (internalPromiseDepth > 0) return false;

  if (hasActiveUserAsync()) return true;

  const stack = getRawStack() ?? "";
  const hasUserFrame =
    stack.includes("<anonymous>") ||
    stack.includes("eval at runJavaScriptSnippet") ||
    stack.includes("eval at runJavaScriptSnippet");

  if (hasUserFrame) return true;
  if (stack.includes("node_modules/next") || stack.includes("next/dist")) return false;
  if (stack.includes("promise-instrumentation") || stack.includes("run-snippet")) {
    return captureUserCallSite(sourceLineResolver) !== undefined;
  }

  return captureUserCallSite(sourceLineResolver) !== undefined;
}

function wrapHandler(
  handler: unknown,
  label: string,
  sourceLine: number | undefined,
): unknown {
  if (typeof handler !== "function") return handler;

  const fn = handler as (...args: unknown[]) => unknown;
  const wrapped = function execLensWrappedHandler(this: unknown, ...args: unknown[]) {
    return fn.apply(this, args);
  } as (...args: unknown[]) => unknown;

  Object.defineProperty(wrapped, "name", {
    value: fn.name || label,
    configurable: true,
  });

  callbackMeta.set(wrapped, { label, sourceLine });
  return wrapped;
}

function runWrappedMicrotask(
  state: PromiseInstrumentationState,
  handler: unknown,
  fallbackLabel: string,
  callSiteLine: number | undefined,
  invoke: () => unknown,
) {
  const meta =
    typeof handler === "function"
      ? callbackMeta.get(handler as (...args: unknown[]) => unknown)
      : undefined;
  const label = meta?.label ?? fallbackLabel;
  const sourceLine = meta?.sourceLine ?? callSiteLine;

  state.hooks.onRunMicrotask(label, sourceLine, () => {
    invoke();
  });
}

function patchPromisePrototype(state: PromiseInstrumentationState) {
  const { originals } = state;
  let microtaskCounter = 0;
  type ThenFulfill = Parameters<typeof originals.then>[0];
  type ThenReject = Parameters<typeof originals.then>[1];

  Promise.prototype.then = function execLensThen(
    this: Promise<unknown>,
    onFulfilled: unknown,
    onRejected: unknown,
  ) {
    const hasFulfilled = typeof onFulfilled === "function";
    const hasRejected = typeof onRejected === "function";
    if (!hasFulfilled && !hasRejected) {
      return originals.then.call(
        this,
        onFulfilled as Parameters<typeof originals.then>[0],
        onRejected as Parameters<typeof originals.then>[1],
      );
    }

    const callSiteLine = captureUserCallSite(state.sourceLineResolver);
    const primaryHandler = hasFulfilled ? onFulfilled : onRejected;
    const fallback = `Promise.then(#${microtaskCounter++})`;
    const label = getHandlerLabel(primaryHandler, fallback);

    if (!shouldInstrumentPromiseCall(state.sourceLineResolver)) {
      return originals.then.call(
        this,
        onFulfilled as Parameters<typeof originals.then>[0],
        onRejected as Parameters<typeof originals.then>[1],
      );
    }

    markThenPatchedExecution();

    scheduleInstrumentedMicrotask(state, this, label, callSiteLine);

    const wrappedFulfilled = hasFulfilled
      ? wrapHandler(onFulfilled, label, callSiteLine)
      : onFulfilled;
    const wrappedRejected = hasRejected
      ? wrapHandler(onRejected, label, callSiteLine)
      : onRejected;

    return originals.then.call(
      this,
      hasFulfilled
        ? (((value: unknown) => {
            let result: unknown;
            runWrappedMicrotask(state, wrappedFulfilled, label, callSiteLine, () => {
              result = (wrappedFulfilled as (value: unknown) => unknown)(value);
            });
            return result;
          }) as ThenFulfill)
        : (onFulfilled as ThenFulfill),
      hasRejected
        ? (((reason: unknown) => {
            let result: unknown;
            runWrappedMicrotask(state, wrappedRejected, label, callSiteLine, () => {
              result = (wrappedRejected as (reason: unknown) => unknown)(reason);
            });
            return result;
          }) as ThenReject)
        : (onRejected as ThenReject),
    );
  } as typeof Promise.prototype.then;

  Promise.prototype.catch = function execLensCatch(
    this: Promise<unknown>,
    onRejected: unknown,
  ) {
    return Promise.prototype.then.call(this, undefined, onRejected as ThenReject);
  } as typeof Promise.prototype.catch;

  Promise.prototype.finally = function execLensFinally(
    this: Promise<unknown>,
    onFinally: unknown,
  ) {
    const callSiteLine = captureUserCallSite(state.sourceLineResolver);
    const fallback = `Promise.finally(#${microtaskCounter++})`;
    const label = getHandlerLabel(onFinally, fallback);

    if (!shouldInstrumentPromiseCall(state.sourceLineResolver)) {
      return originals.finally.call(this, onFinally as () => unknown);
    }
    const wrappedFinally =
      typeof onFinally === "function"
        ? wrapHandler(onFinally, label, callSiteLine)
        : onFinally;

    return originals.then.call(
      this,
      (value: unknown) => {
        scheduleInstrumentedMicrotask(state, this, label, callSiteLine);
        internalPromiseDepth += 1;
        try {
          return originals.then.call(
            Promise.resolve(
              typeof wrappedFinally === "function" ? wrappedFinally() : undefined,
            ) as Promise<unknown>,
            () => value,
          );
        } finally {
          internalPromiseDepth -= 1;
        }
      },
      (reason: unknown) => {
        scheduleInstrumentedMicrotask(state, this, label, callSiteLine);
        internalPromiseDepth += 1;
        try {
          return originals.then.call(
            Promise.resolve(
              typeof wrappedFinally === "function" ? wrappedFinally() : undefined,
            ) as Promise<unknown>,
            () => {
              throw reason;
            },
          );
        } finally {
          internalPromiseDepth -= 1;
        }
      },
    );
  } as typeof Promise.prototype.finally;
}

export function createInstrumentedPromise(
  NativePromise: typeof Promise,
  hooks: PromiseInstrumentationHooks,
  sourceLineResolver: SourceLineResolver,
): typeof Promise {
  function InstrumentedPromise(
    this: unknown,
    executor?: (
      resolve: (value: unknown) => void,
      reject: (reason?: unknown) => void,
    ) => void,
  ) {
    if (!(this instanceof InstrumentedPromise)) {
      throw new TypeError(
        "Class constructor Promise cannot be invoked without 'new'",
      );
    }

    const executorLine = captureUserCallSite(sourceLineResolver);
    const promiseBox: { p?: Promise<unknown> } = {};

    promiseBox.p = new NativePromise((resolve, reject) => {
      if (!executor) return;

      hooks.onPromiseExecutor("Promise executor", executorLine, () => {
        try {
          executor(
            (value) => {
              settleInstrumentedPromise(activeState!, promiseBox.p);
              resolve(value);
            },
            (reason) => {
              settleInstrumentedPromise(activeState!, promiseBox.p);
              reject(reason);
            },
          );
        } catch (error) {
          settleInstrumentedPromise(activeState!, promiseBox.p);
          reject(error);
        }
      });
    });

    getInstrumentedPromiseMeta(promiseBox.p);
    return promiseBox.p;
  }

  InstrumentedPromise.prototype = NativePromise.prototype;

  InstrumentedPromise.resolve = NativePromise.resolve.bind(NativePromise);
  InstrumentedPromise.reject = NativePromise.reject.bind(NativePromise);
  InstrumentedPromise.all = NativePromise.all.bind(NativePromise);
  InstrumentedPromise.race = NativePromise.race.bind(NativePromise);
  InstrumentedPromise.allSettled = NativePromise.allSettled.bind(NativePromise);
  if ("any" in NativePromise) {
    InstrumentedPromise.any = NativePromise.any.bind(NativePromise);
  }
  if ("withResolvers" in NativePromise) {
    InstrumentedPromise.withResolvers = NativePromise.withResolvers.bind(NativePromise);
  }
  if ("try" in NativePromise) {
    InstrumentedPromise.try = NativePromise.try.bind(NativePromise);
  }

  return InstrumentedPromise as unknown as typeof Promise;
}

/** Drain one round of native Promise microtasks without recording steps. */
export function flushNativeMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export function installPromiseInstrumentation(
  hooks: PromiseInstrumentationHooks,
  sourceLineResolver: SourceLineResolver,
): void {
  if (activeState?.patched) {
    restorePromiseInstrumentation();
  }

  const state: PromiseInstrumentationState = {
    hooks,
    sourceLineResolver,
    originals: {
      then: Promise.prototype.then,
      catch: Promise.prototype.catch,
      finally: Promise.prototype.finally,
    },
    patched: true,
  };

  patchPromisePrototype(state);
  activeState = state;
}

export function restorePromiseInstrumentation(): void {
  if (!activeState) return;

  Promise.prototype.then = activeState.originals.then;
  Promise.prototype.catch = activeState.originals.catch;
  Promise.prototype.finally = activeState.originals.finally;
  activeState = null;
}

export type { CallStackFrame, ExecutionStep };
