import type { RunResult } from "@/types/execution";

type ThenHandler = ((value: unknown) => unknown) | null | undefined;

interface PendingHandler {
  onFulfilled: ThenHandler;
  onRejected: ThenHandler;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

interface RunnerBridge {
  enqueueMicrotask: (
    label: string,
    run: () => void,
    sourceLine?: number,
  ) => void;
  lineMap: Map<string, number>;
}

/** Minimal Promise used for deterministic event-loop stepping in the sandbox. */
class SandboxPromise {
  private handlers: PendingHandler[] = [];
  private settled = false;
  private value: unknown;
  private rejected = false;

  constructor(
    private readonly bridge: RunnerBridge,
    executor?: (
      resolve: (value: unknown) => void,
      reject: (reason?: unknown) => void,
    ) => void,
  ) {
    if (!executor) return;

    try {
      executor(
        (value) => this.resolve(value),
        (reason) => this.reject(reason),
      );
    } catch (error) {
      this.reject(error);
    }
  }

  static resolve(bridge: RunnerBridge, value: unknown): SandboxPromise {
    return new SandboxPromise(bridge, (resolve) => resolve(value));
  }

  then(onFulfilled?: ThenHandler, onRejected?: ThenHandler): SandboxPromise {
    const line = this.bridge.lineMap.get("Promise");
    const label = onFulfilled?.name || "Promise.then callback";

    return new SandboxPromise(this.bridge, (resolve, reject) => {
      const run = () => {
        try {
          if (this.rejected) {
            if (onRejected) resolve(onRejected(this.value));
            else reject(this.value);
            return;
          }
          const result = onFulfilled ? onFulfilled(this.value) : this.value;
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      if (this.settled) {
        this.bridge.enqueueMicrotask(label, run, line);
      } else {
        this.handlers.push({ onFulfilled, onRejected, resolve, reject });
      }
    });
  }

  private resolve(value: unknown) {
    if (this.settled) return;
    this.settled = true;
    this.value = value;
    this.flushHandlers(false);
  }

  private reject(reason?: unknown) {
    if (this.settled) return;
    this.settled = true;
    this.rejected = true;
    this.value = reason;
    this.flushHandlers(true);
  }

  private flushHandlers(rejected: boolean) {
    const line = this.bridge.lineMap.get("Promise");

    for (const handler of this.handlers) {
      const label =
        (rejected ? handler.onRejected?.name : handler.onFulfilled?.name) ||
        "Promise.then callback";

      this.bridge.enqueueMicrotask(
        label,
        () => {
          try {
            if (rejected) {
              if (handler.onRejected) handler.resolve(handler.onRejected(this.value));
              else handler.reject(this.value);
              return;
            }
            const result = handler.onFulfilled
              ? handler.onFulfilled(this.value)
              : this.value;
            handler.resolve(result);
          } catch (error) {
            handler.reject(error);
          }
        },
        line,
      );
    }

    this.handlers = [];
  }
}

export { SandboxPromise };
