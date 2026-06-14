import type { Program } from "acorn";

import { analyzeClosures, type ClosureSite } from "@/lib/ast/analyze-closures";
import { analyzeHoisting, type HoistedBinding } from "@/lib/ast/analyze-hoisting";
import { analyzeTdz, type TdzViolation } from "@/lib/ast/analyze-tdz";
import type { SourceLineMapper } from "@/lib/ast/source-map";

export type { ClosureSite, HoistedBinding, TdzViolation };

export interface TeachingAnalysis {
  hoisted: HoistedBinding[];
  closures: ClosureSite[];
  tdzViolations: TdzViolation[];
}

export { analyzeClosures, analyzeHoisting, analyzeTdz };

/** Hoisting, closure sites, and TDZ checks from a parsed program. */
export function analyzeTeaching(
  ast: Program,
  source: string,
  lineMapper?: SourceLineMapper,
): TeachingAnalysis {
  return {
    hoisted: analyzeHoisting(ast, source, lineMapper),
    closures: analyzeClosures(ast, source, lineMapper),
    tdzViolations: analyzeTdz(ast, source, lineMapper),
  };
}

export function formatTdzError(violation: TdzViolation): string {
  return `Cannot access '${violation.name}' before initialization`;
}

export function formatTdzHint(violation: TdzViolation): string {
  return `'${violation.name}' (${violation.kind}) is declared on line ${violation.declarationLine} but accessed on line ${violation.referenceLine} — the temporal dead zone.`;
}
