/**
 * AST pipeline for ExecLens (Phase 3.1+).
 *
 * Lives in `src/lib/ast/` — separate from `src/lib/runner/` so parsing, scope
 * analysis, and source-map utilities stay reusable without pulling in Node/vm
 * execution. The runner imports compile + line-map helpers only; scope snapshots
 * and the Scope panel (3.2) will consume `analyzeSource()` here.
 */
import { analyzeScopes } from "@/lib/ast/analyze-scopes";
import { analyzeTeaching } from "@/lib/ast/analyze-teaching";
import { compileTypeScript, splitInlineSourceMap } from "@/lib/ast/compile-typescript";
import {
  parseProgram,
  type ParsedProgram,
  type ParseProgramOptions,
} from "@/lib/ast/parse-program";
import {
  createIdentityLineMapper,
  createSourceLineMapper,
  createSourceLineResolver,
  type SourceLineMapper,
  type SourceLineResolver,
} from "@/lib/ast/source-map";
import type { SourceAnalysis } from "@/lib/ast/types";

export type {
  BindingInfo,
  BindingKind,
  FunctionBoundary,
  FunctionKind,
  ScopeInfo,
  ScopeKind,
  SourceAnalysis,
  SourcePosition,
} from "@/lib/ast/types";

export {
  analyzeScopes,
  analyzeTeaching,
  compileTypeScript,
  createIdentityLineMapper,
  createSourceLineMapper,
  createSourceLineResolver,
  parseProgram,
  splitInlineSourceMap,
};

export type { ParsedProgram, ParseProgramOptions, SourceLineMapper, SourceLineResolver };

export {
  analyzeClosures,
  analyzeHoisting,
  analyzeTdz,
  formatTdzError,
  formatTdzHint,
} from "@/lib/ast/analyze-teaching";

export type {
  ClosureSite,
  HoistedBinding,
  TeachingAnalysis,
  TdzViolation,
} from "@/lib/ast/analyze-teaching";

/** Parse and analyze user source in one call. */
export async function analyzeSource(
  source: string,
  options: ParseProgramOptions = {},
): Promise<SourceAnalysis> {
  const parsed = await parseProgram(source, options);
  return analyzeScopes(parsed.ast, parsed.source, parsed.lineMapper);
}
