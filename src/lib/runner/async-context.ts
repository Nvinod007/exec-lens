import async_hooks from "node:async_hooks";

const thenPatchedExecutionIds = new Set<number>();
const activeAsyncNames: string[] = [];

export function markThenPatchedExecution(): void {
  thenPatchedExecutionIds.add(async_hooks.executionAsyncId());
}

export function clearThenPatchedExecution(asyncId: number): void {
  thenPatchedExecutionIds.delete(asyncId);
}

export function isThenPatchedExecution(): boolean {
  return thenPatchedExecutionIds.has(async_hooks.executionAsyncId());
}

export function pushActiveAsync(name: string): void {
  activeAsyncNames.push(name);
}

export function popActiveAsync(name: string): void {
  const index = activeAsyncNames.lastIndexOf(name);
  if (index >= 0) activeAsyncNames.splice(index, 1);
}

export function getActiveAsyncName(): string | undefined {
  return activeAsyncNames.at(-1);
}

export function hasActiveUserAsync(): boolean {
  return activeAsyncNames.length > 0;
}
