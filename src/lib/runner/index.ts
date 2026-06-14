import {
  analyzeTeaching,
  compileTypeScript,
  formatTdzError,
  formatTdzHint,
  parseProgram,
} from "@/lib/ast";
import {
  createSourceLineMapper,
  createSourceLineResolver,
} from "@/lib/ast/source-map";
import {
  formatSyntaxIssue,
  parseSyntaxError,
  validateJavaScript,
} from "@/lib/validate-snippet";
import { instrumentUserSource } from "@/lib/runner/instrument-source";
import { runJavaScriptSnippet } from "@/lib/runner/run-snippet";
import type { HoistedBindingView, RunResult } from "@/types/execution";

interface RunOptions {
  language: "javascript" | "typescript";
}

function toHoistedView(
  hoisted: ReturnType<typeof analyzeTeaching>["hoisted"],
): HoistedBindingView[] {
  return hoisted.map((binding) => ({
    name: binding.name,
    kind: binding.kind,
    declarationLine: binding.declarationLine,
    hoistedValue: binding.hoistedValue,
  }));
}

async function runWithTeachingAnalysis(
  source: string,
  language: "javascript" | "typescript",
  run: (instrumented: string, hoisted: HoistedBindingView[]) => Promise<RunResult>,
): Promise<RunResult> {
  const parsed = await parseProgram(source, { language });
  const teaching = analyzeTeaching(parsed.ast, parsed.source, parsed.lineMapper);

  const tdz = teaching.tdzViolations[0];
  if (tdz) {
    return {
      steps: [],
      error: formatTdzError(tdz),
      errorLine: tdz.referenceLine,
      teachingHint: formatTdzHint(tdz),
      language,
    };
  }

  const hoisted = toHoistedView(teaching.hoisted);
  const instrumented = instrumentUserSource(source, teaching.closures);
  return run(instrumented, hoisted);
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
    try {
      return await runWithTeachingAnalysis(source, "typescript", async (instrumented, hoisted) => {
        const compiled = await compileTypeScript(instrumented);
        const lineMapper = compiled.mapJson
          ? createSourceLineMapper(compiled.mapJson)
          : undefined;
        const sourceLineResolver = createSourceLineResolver(lineMapper);
        const output = await runJavaScriptSnippet(source, {
          executable: compiled.code,
          sourceLineResolver,
          hoisted,
        });
        return { ...output, language: "typescript" };
      });
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

  return runWithTeachingAnalysis(source, "javascript", async (instrumented, hoisted) => {
    const output = await runJavaScriptSnippet(source, {
      executable: instrumented,
      hoisted,
    });
    return { ...output, language: "javascript" };
  });
}

export { runJavaScriptSnippet };
