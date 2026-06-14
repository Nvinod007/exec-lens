/** Snapshot of a single frame on the JavaScript call stack. */
export interface CallStackFrame {
  id: string;
  label: string;
  line?: number;
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
    | "run-sync"
    | "schedule-microtask"
    | "schedule-macrotask"
    | "run-microtask"
    | "run-macrotask"
    | "console"
    | "event-loop-tick"
    | "complete"
    | "error";
  label: string;
  activeLine?: number;
  callStack: CallStackFrame[];
  microtaskQueue: QueueItem[];
  macrotaskQueue: QueueItem[];
  console: ConsoleEntry[];
  webApi?: string[];
}

/** Result returned from the runner after executing a snippet. */
export interface RunResult {
  steps: ExecutionStep[];
  error?: string;
  errorLine?: number;
  errorColumn?: number;
  language: "javascript" | "typescript";
}

/** Supported example categories shown in the playground picker. */
export type ExampleCategory =
  | "event-loop"
  | "promises"
  | "async-await"
  | "closures"
  | "hoisting";

/** Pre-built snippet for learning a specific JS concept. */
export interface ExampleSnippet {
  id: string;
  title: string;
  category: ExampleCategory;
  description: string;
  language: "javascript" | "typescript";
  code: string;
}
