import {
  formatSyntaxIssue,
  parseSyntaxError,
  validateJavaScript,
} from "@/lib/validate-snippet";
import { runJavaScriptSnippet } from "@/lib/runner/run-snippet";
import type { RunResult } from "@/types/execution";

interface RunOptions {
  language: "javascript" | "typescript";
}

/**
 * Compile TypeScript when needed, then delegate to the JS runner.
 * esbuild is loaded dynamically to keep it out of the Next.js bundle.
 */
export async function runSnippet(
  source: string,
  options: RunOptions,
): Promise<RunResult> {
  if (options.language === "typescript") {
    const esbuild = await import("esbuild");
    try {
      const result = await esbuild.transform(source, {
        loader: "ts",
        target: "es2020",
        format: "cjs",
      });
      const output = await runJavaScriptSnippet(result.code);
      return { ...output, language: "typescript" };
    } catch (error) {
      const issue = parseSyntaxError(error);
      if (issue) {
        return {
          steps: [],
          error: formatSyntaxIssue(issue),
          errorLine: issue.line,
          errorColumn: issue.column,
          language: "typescript",
        };
      }
      throw error;
    }
  }

  const issue = validateJavaScript(source);
  if (issue) {
    return {
      steps: [],
      error: formatSyntaxIssue(issue),
      errorLine: issue.line,
      errorColumn: issue.column,
      language: "javascript",
    };
  }

  return runJavaScriptSnippet(source);
}

export { runJavaScriptSnippet };
