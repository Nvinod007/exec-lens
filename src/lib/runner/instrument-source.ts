import {
  instrumentAsyncFunctions,
  instrumentAwaitExpressions,
} from "@/lib/runner/instrument-async-source";
import { instrumentClosureCapture } from "@/lib/runner/instrument-closure";
import { instrumentScopeTracking } from "@/lib/runner/instrument-scope";
import { instrumentSyncFunctions } from "@/lib/runner/instrument-sync-functions";
import { instrumentThisBinding } from "@/lib/runner/instrument-this";
import type { ClosureSite } from "@/lib/ast/analyze-closures";

/** Tag each console.log call with its source line for accurate output attribution. */
export function instrumentConsoleLogs(source: string): string {
  return source
    .split("\n")
    .map((line, index) =>
      line.replace(/console\.log\s*\(/g, () => `__consoleLog(${index + 1}, `),
    )
    .join("\n");
}

/** Apply all source transforms before execution (preserves editor line numbers). */
export function instrumentUserSource(
  source: string,
  closureSites: ClosureSite[] = [],
): string {
  let result = instrumentClosureCapture(source, closureSites);
  result = instrumentConsoleLogs(result);
  result = instrumentAwaitExpressions(result);
  result = instrumentAsyncFunctions(result);
  result = instrumentSyncFunctions(result);
  result = instrumentThisBinding(result);
  result = instrumentScopeTracking(result);
  return result;
}
