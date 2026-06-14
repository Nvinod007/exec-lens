/** Inject sync-function enter/exit hooks for call-stack frames. */
export function instrumentSyncFunctions(source: string): string {
  const functionPattern = /^function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/gm;
  const inserts: { index: number; text: string }[] = [];

  for (const match of source.matchAll(functionPattern)) {
    const name = match[1];
    const openBraceIndex = match.index! + match[0].length;
    const line = source.slice(0, match.index).split("\n").length;

    inserts.push({
      index: openBraceIndex,
      text: `\n  __execLensSyncEnter(${JSON.stringify(name)}, ${line});`,
    });

    let depth = 1;
    let index = openBraceIndex;
    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      index += 1;
    }

    const closeBraceIndex = index - 1;
    inserts.push({
      index: closeBraceIndex,
      text: `\n  __execLensSyncExit(${JSON.stringify(name)});`,
    });
  }

  inserts.sort((left, right) => right.index - left.index);

  let result = source;
  for (const insert of inserts) {
    result = result.slice(0, insert.index) + insert.text + result.slice(insert.index);
  }

  return result;
}
