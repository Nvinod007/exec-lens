import * as acorn from "acorn";
import type { Node } from "acorn";

type AcornNode = Node & Record<string, unknown>;

interface Insert {
  index: number;
  text: string;
}

function asNode(value: unknown): AcornNode | undefined {
  if (value && typeof value === "object" && "type" in value) {
    return value as AcornNode;
  }
  return undefined;
}

function lineFromNode(node: AcornNode): number {
  const loc = node.loc as { start: { line: number } } | null | undefined;
  return loc?.start.line ?? 1;
}

function inferLabel(fnNode: AcornNode, parent: AcornNode | undefined): string {
  if (parent?.type === "VariableDeclarator") {
    const id = asNode(parent.id);
    if (id?.type === "Identifier") return String(id.name ?? "anonymous");
  }
  if (parent?.type === "AssignmentExpression") {
    const left = asNode(parent.left);
    if (left?.type === "Identifier") return String(left.name ?? "anonymous");
  }
  if (parent?.type === "Property") {
    const key = asNode(parent.key);
    if (key?.type === "Identifier") return String(key.name ?? "anonymous");
    if (key?.type === "Literal") return String(key.value ?? "anonymous");
  }
  if (parent?.type === "MethodDefinition") {
    const key = asNode(parent.key);
    if (key?.type === "Identifier") return String(key.name ?? "anonymous");
  }
  const id = asNode(fnNode.id);
  if (id?.type === "Identifier") return String(id.name ?? "anonymous");
  return "anonymous";
}

function bodyHasSyncEnter(source: string, body: AcornNode): boolean {
  const bodyStart = body.start;
  if (typeof bodyStart !== "number") return false;
  const slice = source.slice(bodyStart, (body.end as number | undefined) ?? bodyStart + 120);
  return /^\{\s*\n\s*__execLensSyncEnter\(/.test(slice);
}

function bodyHasAsyncEnter(source: string, body: AcornNode): boolean {
  const bodyStart = body.start;
  if (typeof bodyStart !== "number") return false;
  const slice = source.slice(bodyStart, (body.end as number | undefined) ?? bodyStart + 120);
  return /^\{\s*\n\s*__execLensAsyncEnter\(/.test(slice);
}

function insertAfterBodyHook(
  inserts: Insert[],
  source: string,
  body: AcornNode,
  hookPattern: RegExp,
  text: string,
) {
  const bodyStart = body.start as number;
  const slice = source.slice(bodyStart);
  const match = slice.match(hookPattern);
  const insertAt = match ? bodyStart + match[0].length : bodyStart + 1;
  inserts.push({ index: insertAt, text });
}

function insertSyncExit(inserts: Insert[], body: AcornNode, label: string) {
  const bodyEnd = body.end;
  if (typeof bodyEnd !== "number" || bodyEnd <= 0) return;
  inserts.push({
    index: bodyEnd - 1,
    text: `\n  __execLensSyncExit(${JSON.stringify(label)});`,
  });
}

function bodyHasRecordThis(source: string, body: AcornNode): boolean {
  const bodyStart = body.start;
  const bodyEnd = body.end;
  if (typeof bodyStart !== "number" || typeof bodyEnd !== "number") return false;
  return /__execLensRecordThis\(/.test(source.slice(bodyStart, bodyEnd));
}

function instrumentBlockBody(
  inserts: Insert[],
  source: string,
  body: AcornNode,
  label: string,
  line: number,
  recordKind: "function" | "arrow",
) {
  if (body.type !== "BlockStatement") return;
  if (bodyHasRecordThis(source, body)) return;

  const recordCall = `__execLensRecordThis(${JSON.stringify(recordKind)}, this);`;

  if (bodyHasAsyncEnter(source, body)) {
    insertAfterBodyHook(
      inserts,
      source,
      body,
      /^\{\s*\n\s*__execLensAsyncEnter\([^)]+\);\s*\n/,
      `  ${recordCall}\n`,
    );
    return;
  }

  if (bodyHasSyncEnter(source, body)) {
    insertAfterBodyHook(
      inserts,
      source,
      body,
      /^\{\s*\n\s*__execLensSyncEnter\([^)]+\);\s*\n/,
      `  ${recordCall}\n`,
    );
    return;
  }

  const bodyStart = body.start as number;
  inserts.push({
    index: bodyStart + 1,
    text: `\n  __execLensSyncEnter(${JSON.stringify(label)}, ${line});\n  ${recordCall}\n`,
  });
  insertSyncExit(inserts, body, label);
}

function instrumentFunctionNode(
  inserts: Insert[],
  source: string,
  fnNode: AcornNode,
  parent: AcornNode | undefined,
) {
  const isArrow = fnNode.type === "ArrowFunctionExpression";
  const recordKind = isArrow ? "arrow" : "function";
  const label = inferLabel(fnNode, parent);
  const line = lineFromNode(fnNode);
  const body = asNode(fnNode.body);

  if (!body) return;

  if (body.type === "BlockStatement") {
    instrumentBlockBody(inserts, source, body, label, line, recordKind);
  }
}

function walkFunctionNodes(node: AcornNode, inserts: Insert[], source: string, parent?: AcornNode) {
  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression" ||
    node.type === "MethodDefinition"
  ) {
    if (node.type === "MethodDefinition") {
      const value = asNode(node.value);
      if (value) instrumentFunctionNode(inserts, source, value, node);
    } else {
      instrumentFunctionNode(inserts, source, node, parent);
    }
  }

  for (const key of Object.keys(node)) {
    if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        const childNode = asNode(child);
        if (childNode) walkFunctionNodes(childNode, inserts, source, node);
      }
    } else {
      const childNode = asNode(value);
      if (childNode) walkFunctionNodes(childNode, inserts, source, node);
    }
  }
}

/**
 * Inject `__execLensRecordThis` at function entry and extend stack hooks to methods
 * and function expressions not covered by `instrumentSyncFunctions`.
 */
export function instrumentThisBinding(source: string): string {
  let ast: acorn.Program;
  try {
    ast = acorn.parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      locations: true,
    });
  } catch {
    return source;
  }

  const inserts: Insert[] = [];

  for (const statement of ast.body as AcornNode[]) {
    walkFunctionNodes(statement, inserts, source);
  }

  if (inserts.length === 0) return source;

  inserts.sort((left, right) => right.index - left.index);

  let result = source;
  for (const insert of inserts) {
    result = result.slice(0, insert.index) + insert.text + result.slice(insert.index);
  }

  return result;
}
