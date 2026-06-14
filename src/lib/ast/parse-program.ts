import * as acorn from "acorn";
import type { Node, Program } from "acorn";

import { compileTypeScript } from "@/lib/ast/compile-typescript";
import { createSourceLineMapper } from "@/lib/ast/source-map";
import type { SourceLineMapper } from "@/lib/ast/source-map";

export interface ParsedProgram {
  ast: Program;
  /** Original editor / instrumented source the AST positions refer to. */
  source: string;
  /** Present when TypeScript was compiled before parsing. */
  lineMapper?: SourceLineMapper;
  /** Compiled JS when language was typescript. */
  compiledSource?: string;
}

export interface ParseProgramOptions {
  language?: "javascript" | "typescript";
}

/** Parse user source into an Acorn AST with source locations. */
export async function parseProgram(
  source: string,
  options: ParseProgramOptions = {},
): Promise<ParsedProgram> {
  const language = options.language ?? "javascript";

  if (language === "typescript") {
    const compiled = await compileTypeScript(source);

    const ast = acorn.parse(compiled.code, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      locations: true,
    });

    const lineMapper = compiled.mapJson
      ? createSourceLineMapper(compiled.mapJson)
      : undefined;

    return {
      ast,
      source,
      lineMapper,
      compiledSource: compiled.code,
    };
  }

  const ast = acorn.parse(source, {
    ecmaVersion: "latest",
    sourceType: "script",
    allowAwaitOutsideFunction: true,
    allowReturnOutsideFunction: true,
    locations: true,
  });

  return { ast, source };
}

export type { Node, Program };
