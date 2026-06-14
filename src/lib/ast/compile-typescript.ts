/** Trailing esbuild inline source map comment. */
const INLINE_SOURCE_MAP_RE =
  /\/\/# sourceMappingURL=data:application\/json(?:;charset=utf-8)?;base64,([A-Za-z0-9+/=]+)\s*$/;

export interface TypeScriptCompileResult {
  /** Compiled JS without the trailing sourceMappingURL comment. */
  code: string;
  /** Parsed source map JSON (from inline comment or esbuild `.map`). */
  mapJson: string | undefined;
}

/** Split compiled output into runnable code and inline base64 source map JSON. */
export function splitInlineSourceMap(compiledCode: string): TypeScriptCompileResult {
  const match = compiledCode.match(INLINE_SOURCE_MAP_RE);
  if (!match?.[1]) {
    return { code: compiledCode, mapJson: undefined };
  }

  const mapJson = Buffer.from(match[1], "base64").toString("utf8");
  const code = compiledCode.slice(0, match.index).replace(/\s*$/, "\n");

  return { code, mapJson };
}

/** Compile TypeScript with esbuild inline source maps for editor line mapping. */
export async function compileTypeScript(source: string): Promise<TypeScriptCompileResult> {
  const esbuild = await import("esbuild");
  const result = await esbuild.transform(source, {
    loader: "ts",
    target: "es2020",
    format: "cjs",
    sourcemap: "inline",
  });

  const split = splitInlineSourceMap(result.code);

  return {
    code: split.code,
    mapJson: split.mapJson ?? result.map ?? undefined,
  };
}
