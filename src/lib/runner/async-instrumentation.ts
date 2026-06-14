import async_hooks from "node:async_hooks";

import {
  clearThenPatchedExecution,
  getActiveAsyncName,
  isThenPatchedExecution,
  popActiveAsync,
  pushActiveAsync,
} from "@/lib/runner/async-context";
import {
  captureUserCallSite,
  toUserSourceLine,
} from "@/lib/runner/promise-instrumentation";

const MAX_AWAIT_EXPR_LENGTH = 45;
const TRUNCATION_SUFFIX = "...";

export interface AsyncInstrumentationHooks {
  onAsyncEnter: (name: string, line: number | undefined) => void;
  onAwaitSuspend: (label: string, line: number | undefined) => void;
  onAwaitResume: (label: string, line: number | undefined) => void;
  onAsyncExit: (name: string) => void;
}

interface TrackedAwait {
  label: string;
  line?: number;
  functionName: string;
  suspendRecorded: boolean;
}

interface AsyncInstrumentationState {
  hooks: AsyncInstrumentationHooks;
  source: string;
  sourceLineOffset: number;
  trackedAwaits: Map<number, TrackedAwait>;
  hook: async_hooks.AsyncHook;
}

let activeState: AsyncInstrumentationState | null = null;

function getRawStack(): string | undefined {
  return new Error().stack;
}

function parseUserAsyncFrame(
  sourceLineOffset: number,
): { name: string; line?: number } | undefined {
  const stack = getRawStack();
  if (!stack) return undefined;

  for (const frame of stack.split("\n").slice(1)) {
    if (
      frame.includes("async-instrumentation") ||
      frame.includes("promise-instrumentation") ||
      frame.includes("run-snippet") ||
      frame.includes("node:") ||
      frame.includes("node_modules")
    ) {
      continue;
    }

    const asyncMatch = frame.match(/at async (\w+) .*<anonymous>:(\d+):\d+/);
    if (asyncMatch) {
      return {
        name: asyncMatch[1],
        line: toUserSourceLine(Number(asyncMatch[2]), sourceLineOffset),
      };
    }

    const fnMatch = frame.match(/at (\w+) .*<anonymous>:(\d+):\d+/);
    if (fnMatch && fnMatch[1] !== "Object" && fnMatch[1] !== "Function") {
      return {
        name: fnMatch[1],
        line: toUserSourceLine(Number(fnMatch[2]), sourceLineOffset),
      };
    }
  }

  return undefined;
}

function resolveAwaitLine(
  source: string,
  frameLine: number | undefined,
  sourceLineOffset: number,
): number | undefined {
  if (frameLine) {
    const lines = source.split("\n");
    const start = Math.max(0, frameLine - 1);
    for (let index = start; index < lines.length; index += 1) {
      if (lines[index]?.includes("await ")) {
        return index + 1;
      }
    }
    for (let index = start; index >= 0; index -= 1) {
      if (lines[index]?.includes("await ")) {
        return index + 1;
      }
    }
  }

  return captureUserCallSite(sourceLineOffset);
}

export function buildAwaitLabel(source: string, line: number | undefined): string {
  if (!line) return "await …";

  const sourceLine = source.split("\n")[line - 1];
  if (!sourceLine) return `await (line ${line})`;

  const match = sourceLine.match(/await\s+(.+)/);
  if (!match) return `await (line ${line})`;

  let expression = match[1].replace(/;?\s*$/, "").trim();
  if (expression.length > MAX_AWAIT_EXPR_LENGTH) {
    expression = `${expression.slice(0, MAX_AWAIT_EXPR_LENGTH - TRUNCATION_SUFFIX.length)}${TRUNCATION_SUFFIX}`;
  }
  return `await ${expression}`;
}

function shouldTrackAwaitInit(state: AsyncInstrumentationState): boolean {
  if (isThenPatchedExecution()) return false;

  const frame = parseUserAsyncFrame(state.sourceLineOffset);
  if (!frame) return false;

  const activeName = getActiveAsyncName();
  return activeName === frame.name;
}

function shouldPopAsyncFrameAfterAwait(
  source: string,
  awaitLine: number | undefined,
): boolean {
  if (!awaitLine) return false;

  const lines = source.split("\n");
  for (let lineNum = awaitLine + 1; lineNum <= lines.length; lineNum += 1) {
    const trimmed = lines[lineNum - 1]?.trim() ?? "";
    if (!trimmed || trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("}")) return true;
    return false;
  }

  return true;
}

function createAsyncHook(state: AsyncInstrumentationState): async_hooks.AsyncHook {
  return async_hooks.createHook({
    init(asyncId, type) {
      if (type !== "PROMISE" || activeState !== state) return;
      if (!shouldTrackAwaitInit(state)) return;

      const frame = parseUserAsyncFrame(state.sourceLineOffset);
      if (!frame) return;

      const awaitLine =
        captureUserCallSite(state.sourceLineOffset) ??
        resolveAwaitLine(state.source, frame.line, state.sourceLineOffset);
      const label = buildAwaitLabel(state.source, awaitLine);

      state.trackedAwaits.set(asyncId, {
        label,
        line: awaitLine,
        functionName: frame.name,
        suspendRecorded: false,
      });
    },

    before(asyncId) {
      const tracked = state.trackedAwaits.get(asyncId);
      if (!tracked) return;

      if (!tracked.suspendRecorded) {
        tracked.suspendRecorded = true;
      }
    },

    after(asyncId) {
      clearThenPatchedExecution(asyncId);

      const tracked = state.trackedAwaits.get(asyncId);
      if (!tracked) return;

      state.trackedAwaits.delete(asyncId);

      if (
        tracked.suspendRecorded &&
        getActiveAsyncName() === tracked.functionName &&
        shouldPopAsyncFrameAfterAwait(state.source, tracked.line)
      ) {
        registerAsyncExit(tracked.functionName);
      }
    },

    destroy(asyncId) {
      state.trackedAwaits.delete(asyncId);
      clearThenPatchedExecution(asyncId);
    },
  });
}

export function installAsyncInstrumentation(
  hooks: AsyncInstrumentationHooks,
  source: string,
  sourceLineOffset = 1,
): void {
  if (activeState) {
    restoreAsyncInstrumentation();
  }

  const state: AsyncInstrumentationState = {
    hooks,
    source,
    sourceLineOffset,
    trackedAwaits: new Map(),
    hook: undefined as unknown as async_hooks.AsyncHook,
  };

  state.hook = createAsyncHook(state);
  state.hook.enable();
  activeState = state;
}

export function registerAsyncEnter(name: string, line: number | undefined): void {
  if (!activeState) return;
  pushActiveAsync(name);
  activeState.hooks.onAsyncEnter(name, line);
}

export function registerAsyncExit(name: string): void {
  if (!activeState) return;
  popActiveAsync(name);
  activeState.hooks.onAsyncExit(name);
}

export function restoreAsyncInstrumentation(): void {
  if (!activeState) return;
  activeState.hook.disable();
  activeState.trackedAwaits.clear();
  activeState = null;
}
