import * as acorn from "acorn";
import type { Node } from "acorn";

import type { ClosureSite } from "@/lib/ast/analyze-closures";

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

function siteKey(site: ClosureSite): string {
  return `${site.line}:${site.label}`;
}

/**
 * Inject `__execLensClosureCreated` when inner function values are created.
 * Wraps the function expression in `( hook(...), fn )` so return/assign stay valid.
 */
export function instrumentClosureCapture(
  source: string,
  sites: ClosureSite[],
): string {
  if (sites.length === 0) return source;

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

  const sitesByLine = new Map<number, ClosureSite[]>();
  for (const site of sites) {
    const list = sitesByLine.get(site.line) ?? [];
    list.push(site);
    sitesByLine.set(site.line, list);
  }

  const inserts: Insert[] = [];
  const used = new Set<string>();

  function tryWrap(node: AcornNode, label: string) {
    const line = lineFromNode(node);
    const candidates = sitesByLine.get(line) ?? [];
    const site = candidates.find((entry) => entry.label === label && !used.has(siteKey(entry)));
    if (!site) return;

    const start = node.start;
    const end = node.end;
    if (typeof start !== "number" || typeof end !== "number") return;

    used.add(siteKey(site));
    const namesJson = JSON.stringify(site.captured.map((binding) => binding.name));
    const hook = `__execLensClosureCreated(${line}, ${JSON.stringify(site.label)}, ${namesJson})`;

    inserts.push({ index: start, text: `( ${hook}, ` });
    inserts.push({ index: end, text: " )" });
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
      if (key?.name) return String(key.name);
    }
    const id = asNode(fnNode.id);
    if (id?.type === "Identifier") return String(id.name ?? "anonymous");
    return "anonymous";
  }

  function walk(node: AcornNode, parent?: AcornNode) {
    if (
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionDeclaration"
    ) {
      const parentType = parent?.type;
      if (node.type === "FunctionDeclaration" && parentType === "Program") {
        // top-level hoisted declaration — no inline creation hook
      } else {
        tryWrap(node, inferLabel(node, parent));
      }
    }

    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const child of value) {
          const childNode = asNode(child);
          if (childNode) walk(childNode, node);
        }
      } else {
        const childNode = asNode(value);
        if (childNode) walk(childNode, node);
      }
    }
  }

  for (const statement of ast.body as AcornNode[]) {
    walk(statement);
  }

  if (inserts.length === 0) return source;

  inserts.sort((left, right) => right.index - left.index);

  let result = source;
  for (const insert of inserts) {
    result = result.slice(0, insert.index) + insert.text + result.slice(insert.index);
  }

  return result;
}
