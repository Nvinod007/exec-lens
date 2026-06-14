import {
  instrumentAsyncFunctions,
  instrumentAwaitExpressions,
} from "@/lib/runner/instrument-async-source";
import { instrumentSyncFunctions } from "@/lib/runner/instrument-sync-functions";

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
export function instrumentUserSource(source: string): string {
  let result = instrumentConsoleLogs(source);
  result = instrumentAwaitExpressions(result);
  result = instrumentAsyncFunctions(result);
  result = instrumentSyncFunctions(result);
  return result;
}
