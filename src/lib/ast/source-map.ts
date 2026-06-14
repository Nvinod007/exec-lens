import { originalPositionFor, TraceMap } from "@jridgewell/trace-mapping";

import type { SourcePosition } from "@/lib/ast/types";

/** Maps generated (compiled) positions back to editor source lines. */
export interface SourceLineMapper {
  /** 1-based generated line → 1-based editor line, if mapped. */
  toEditorLine(generatedLine: number, generatedColumn?: number): number | undefined;
  /** Full position mapping when column accuracy is needed. */
  toEditorPosition(
    generatedLine: number,
    generatedColumn?: number,
  ): SourcePosition | undefined;
}

const VM_PREAMBLE_LINES = 1;

/** Build a mapper from an esbuild JSON source map string. */
export function createSourceLineMapper(inlineMap: string): SourceLineMapper {
  const trace = new TraceMap(inlineMap);

  function toEditorPosition(
    generatedLine: number,
    generatedColumn = 0,
  ): SourcePosition | undefined {
    const mapped = originalPositionFor(trace, {
      line: generatedLine,
      column: generatedColumn,
    });
    if (mapped.line === null || mapped.line === undefined) return undefined;
    return {
      line: mapped.line,
      column: mapped.column ?? 0,
    };
  }

  return {
    toEditorLine(generatedLine, generatedColumn = 0) {
      return toEditorPosition(generatedLine, generatedColumn)?.line;
    },
    toEditorPosition,
  };
}

/** Identity mapper for plain JavaScript runs (no compile step). */
export function createIdentityLineMapper(): SourceLineMapper {
  return {
    toEditorLine(line) {
      return line >= 1 ? line : undefined;
    },
    toEditorPosition(line, column = 0) {
      return line >= 1 ? { line, column } : undefined;
    },
  };
}

/**
 * Resolves stack / runtime lines to editor lines.
 * Injected instrumentation already carries editor line numbers.
 */
export interface SourceLineResolver {
  fromEditorLine(line: number | undefined): number | undefined;
  fromEvalLine(evalLine: number | undefined): number | undefined;
  fromGeneratedLine(generatedLine: number | undefined): number | undefined;
  readonly hasSourceMap: boolean;
}

export function createSourceLineResolver(
  mapper: SourceLineMapper | undefined,
): SourceLineResolver {
  return {
    hasSourceMap: mapper !== undefined,

    fromEditorLine(line) {
      return line;
    },

    fromEvalLine(evalLine) {
      if (evalLine === undefined) return undefined;
      const generatedLine = evalLine - VM_PREAMBLE_LINES;
      if (generatedLine < 1) return undefined;
      return mapper?.toEditorLine(generatedLine) ?? generatedLine;
    },

    fromGeneratedLine(generatedLine) {
      if (generatedLine === undefined || generatedLine < 1) return undefined;
      return mapper?.toEditorLine(generatedLine) ?? generatedLine;
    },
  };
}

export { VM_PREAMBLE_LINES };
