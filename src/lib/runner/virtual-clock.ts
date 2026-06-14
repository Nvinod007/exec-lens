/** Pending timer registered via setTimeout — lives in the Web API until due. */
export interface VirtualTimer {
  id: string;
  label: string;
  callback: () => void;
  delay: number;
  /** Virtual time (ms) when the timer was registered. */
  scheduledAt: number;
  /** Virtual time (ms) when the callback should enter the macrotask queue. */
  fireAt: number;
  sourceLine?: number;
}

export function parseTimerDelay(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function formatTimerWebApiEntry(timer: VirtualTimer): string {
  if (timer.delay === 0) {
    return `setTimeout(${timer.label}, 0ms) → next macrotask turn`;
  }
  return `setTimeout(${timer.label}, ${timer.delay}ms) → fires at t=${timer.fireAt}ms`;
}

export function formatMacrotaskLabel(label: string, delay: number): string {
  return delay > 0 ? `${label} (+${delay}ms)` : label;
}

export function formatScheduleLabel(label: string, delay: number): string {
  return delay > 0
    ? `Scheduled macrotask: ${label} (+${delay}ms)`
    : `Scheduled macrotask: ${label}`;
}

export function formatRunLabel(label: string, delay: number): string {
  return delay > 0
    ? `Running macrotask: ${label} (+${delay}ms)`
    : `Running macrotask: ${label}`;
}

export function formatClockAdvanceLabel(timeMs: number): string {
  return `Advance virtual clock to t=${timeMs}ms`;
}

/** Return timers due at or before `virtualTime`, preserving registration order. */
export function collectDueTimers(
  timers: VirtualTimer[],
  virtualTime: number,
): { due: VirtualTimer[]; pending: VirtualTimer[] } {
  const due: VirtualTimer[] = [];
  const pending: VirtualTimer[] = [];

  for (const timer of timers) {
    if (timer.fireAt <= virtualTime) {
      due.push(timer);
    } else {
      pending.push(timer);
    }
  }

  return { due, pending };
}

export function findEarliestTimer(timers: VirtualTimer[]): VirtualTimer | undefined {
  if (timers.length === 0) return undefined;
  return timers.reduce((earliest, timer) =>
    timer.fireAt < earliest.fireAt ? timer : earliest,
  );
}
