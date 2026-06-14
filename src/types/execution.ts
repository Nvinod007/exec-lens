/** How `this` was bound for the current call-stack frame (Phase 3.4). */
export type ThisBindingKind =
  | "method"
  | "strict-undefined"
  | "lexical-arrow"
  | "global";

/** Runtime `this` value shown in the Scope panel. */
export interface ThisBinding {
  value: string;
  kind: ThisBindingKind;
  /** Enclosing frame label for arrow functions (lexical `this`). */
  lexicalFrom?: string;
}

/** Snapshot of a single frame on the JavaScript call stack. */
export interface CallStackFrame {
  id: string;
  label: string;
  line?: number;
  /** True when this frame belongs to an async function. */
  async?: boolean;
  /** True when the frame is paused at an await. */
  suspended?: boolean;
  /** Bound `this` for this frame when inside a function body. */
  thisBinding?: ThisBinding;
}

/** Lexical binding kind shown in the Scope panel. */
export type ScopeBindingKind = "let" | "const" | "var" | "param";

/** A live variable binding captured at a step boundary. */
export interface ScopeBinding {
  name: string;
  value: string;
  kind: ScopeBindingKind;
}

/** Outer binding captured when an inner function closes over it. */
export interface ClosureCapture {
  name: string;
  value: string;
  kind: ScopeBindingKind;
  /** Call-stack frame label where the binding lives. */
  fromFrame: string;
}

/** `var` / `function` declaration lifted before runtime execution. */
export interface HoistedBindingView {
  name: string;
  kind: "var" | "function";
  declarationLine: number;
  hoistedValue: string;
}

/** Item waiting in the microtask or macrotask queue. */
export interface QueueItem {
  id: string;
  label: string;
  sourceLine?: number;
  kind: "microtask" | "macrotask";
}

/** Console output captured during a step. */
export interface ConsoleEntry {
  id: string;
  values: string[];
  /** 1-based source line of the console.log call. */
  line?: number;
  /** Wall-clock time when this log was captured (epoch ms). */
  timestamp?: number;
  /** 1-based order of this log in the full run. */
  index?: number;
}

/** One recorded moment during execution — drives the visualizer timeline. */
export interface ExecutionStep {
  id: number;
  phase:
    | "evaluate-script"
    | "hoisting"
    | "closure-capture"
    | "run-sync"
    | "schedule-microtask"
    | "schedule-macrotask"
    | "run-microtask"
    | "run-macrotask"
    | "await-suspend"
    | "await-resume"
    | "console"
    | "event-loop-tick"
    | "complete"
    | "error";
  label: string;
  activeLine?: number;
  /**
   * 1-based editor line when mapping is guaranteed (injected instrumentation or source map).
   * Prefer over `activeLine` when `sourceLineMapped` is true.
   */
  sourceLine?: number;
  /** True when `sourceLine` was set via editor inject or TS source map — not a heuristic. */
  sourceLineMapped?: boolean;
  callStack: CallStackFrame[];
  microtaskQueue: QueueItem[];
  macrotaskQueue: QueueItem[];
  console: ConsoleEntry[];
  webApi?: string[];
  /** Live bindings keyed by `CallStackFrame.id` at this step. */
  scopes?: Record<string, ScopeBinding[]>;
  /** Hoisted declarations shown before synchronous execution (Phase 3.3). */
  hoisting?: HoistedBindingView[];
  /** Captured outer bindings keyed by `CallStackFrame.id` when a closure is created. */
  closureCaptures?: Record<string, ClosureCapture[]>;
}

/**
 * Preferred 1-based editor line for highlighting during playback.
 * Uses guaranteed `sourceLine` when mapped; falls back to `activeLine`.
 */
export function getStepEditorLine(step: ExecutionStep | undefined): number | undefined {
  if (!step) return undefined;
  if (step.sourceLineMapped && step.sourceLine !== undefined) return step.sourceLine;
  return step.activeLine;
}

/** Bindings for the top (currently running) call-stack frame. */
export function getTopFrameScopeBindings(
  step: ExecutionStep | undefined,
  frames: CallStackFrame[],
): ScopeBinding[] {
  const topFrame = frames.at(-1);
  if (!topFrame || !step?.scopes) return [];
  return step.scopes[topFrame.id] ?? [];
}

/** Count of tracked variables on the top stack frame. */
export function getTopFrameScopeCount(
  step: ExecutionStep | undefined,
  frames: CallStackFrame[],
): number {
  return getTopFrameScopeBindings(step, frames).length;
}

/** Result returned from the runner after executing a snippet. */
export interface RunResult {
  steps: ExecutionStep[];
  error?: string;
  errorLine?: number;
  errorColumn?: number;
  /** Teaching hint for TDZ and similar static/runtime errors. */
  teachingHint?: string;
  language: "javascript" | "typescript";
}

/** Supported example categories shown in the playground picker. */
export type ExampleCategory =
  | "event-loop"
  | "promises"
  | "async-await"
  | "closures"
  | "hoisting"
  | "this-binding";

/** Pre-built snippet for learning a specific JS concept. */
export interface ExampleSnippet {
  id: string;
  title: string;
  category: ExampleCategory;
  description: string;
  language: "javascript" | "typescript";
  code: string;
}
