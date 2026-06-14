/** Inject async-function entry/exit hooks for call-stack frames. */
export function instrumentAsyncFunctions(source: string): string {
  let result = source;

  // IIFE first — the general async-function pattern also matches inside `(async function …)`.
  result = result.replace(
    /\(\s*async\s+function\s+(\w*)\s*\([^)]*\)\s*\{/g,
    (match, name: string, offset: number) => {
      const line = source.slice(0, offset).split("\n").length;
      const label = name || "async IIFE";
      return `${match}\n  __execLensAsyncEnter(${JSON.stringify(label)}, ${line});`;
    },
  );

  result = result.replace(
    /\basync\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g,
    (match, name: string, offset: number) => {
      if (offset > 0 && source[offset - 1] === "(") return match;
      const line = source.slice(0, offset).split("\n").length;
      return `${match}\n  __execLensAsyncEnter(${JSON.stringify(name)}, ${line});`;
    },
  );

  result = result.replace(
    /(?:const|let|var)\s+(\w+)\s*=\s*async\s+function\s*\([^)]*\)\s*\{/g,
    (match, name: string, offset: number) => {
      const line = source.slice(0, offset).split("\n").length;
      return `${match}\n  __execLensAsyncEnter(${JSON.stringify(name)}, ${line});`;
    },
  );

  result = result.replace(
    /(?:const|let|var)\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{/g,
    (match, name: string, offset: number) => {
      const line = source.slice(0, offset).split("\n").length;
      return `${match}\n  __execLensAsyncEnter(${JSON.stringify(name)}, ${line});`;
    },
  );

  return injectAsyncExits(result);
}

function injectAsyncExits(modifiedSource: string): string {
  const patterns: Array<{ pattern: RegExp; skipIfPrefixedByParen?: boolean }> = [
    { pattern: /\basync\s+function\s+(\w+)\s*\([^)]*\)\s*\{/g, skipIfPrefixedByParen: true },
    { pattern: /(?:const|let|var)\s+(\w+)\s*=\s*async\s+function\s*\([^)]*\)\s*\{/g },
    { pattern: /(?:const|let|var)\s+(\w+)\s*=\s*async\s*\([^)]*\)\s*=>\s*\{/g },
    { pattern: /\(\s*async\s+function\s+(\w*)\s*\([^)]*\)\s*\{/g },
  ];

  const inserts: { index: number; text: string }[] = [];

  for (const { pattern, skipIfPrefixedByParen } of patterns) {
    for (const match of modifiedSource.matchAll(pattern)) {
      const offset = match.index ?? 0;
      if (skipIfPrefixedByParen && offset > 0 && modifiedSource[offset - 1] === "(") {
        continue;
      }

      const name = match[1] || "async IIFE";
      const openBraceIndex = match.index! + match[0].length;
      let depth = 1;
      let index = openBraceIndex;
      while (index < modifiedSource.length && depth > 0) {
        const char = modifiedSource[index];
        if (char === "{") depth += 1;
        else if (char === "}") depth -= 1;
        index += 1;
      }
      const closeBraceIndex = index - 1;
      inserts.push({
        index: closeBraceIndex,
        text: `\n  __execLensAsyncExit(${JSON.stringify(name)});`,
      });
    }
  }

  inserts.sort((left, right) => right.index - left.index);

  let result = modifiedSource;
  for (const insert of inserts) {
    result = result.slice(0, insert.index) + insert.text + result.slice(insert.index);
  }

  return result;
}

/** Wrap each `await expr` so suspend is recorded synchronously before the await. */
export function instrumentAwaitExpressions(source: string): string {
  return source
    .split("\n")
    .map((line, index) => {
      if (!/\bawait\s+/.test(line) || line.includes("__execLensAwaitWrap")) {
        return line;
      }

      const lineNumber = index + 1;
      return line.replace(
        /\bawait\s+(.+?)(;?\s*)$/,
        (_, expression: string, suffix: string) =>
          `await __execLensAwaitWrap(${lineNumber}, ${expression})${suffix}`,
      );
    })
    .join("\n");
}
