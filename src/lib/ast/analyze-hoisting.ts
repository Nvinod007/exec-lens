import type { Program } from "acorn";

import { analyzeScopes } from "@/lib/ast/analyze-scopes";
import type { SourceLineMapper } from "@/lib/ast/source-map";

export interface HoistedBinding {
  name: string;
  kind: "var" | "function";
  /** 1-based line where the declaration appears in source. */
  declarationLine: number;
  /** Teaching value shown before the declaration line runs. */
  hoistedValue: string;
}

function asNode(value: unknown): Record<string, unknown> & { type: string } | undefined {
  if (value && typeof value === "object" && "type" in value) {
    return value as Record<string, unknown> & { type: string };
  }
  return undefined;
}

function asNodeList(value: unknown): Array<Record<string, unknown> & { type: string }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> & { type: string } =>
    Boolean(item && typeof item === "object" && "type" in item),
  );
}

function lineFromNode(node: Record<string, unknown>): number | undefined {
  const loc = node.loc as { start: { line: number } } | null | undefined;
  return loc?.start.line;
}

function functionDisplayName(node: Record<string, unknown>): string | null {
  const id = asNode(node.id);
  if (id?.name && typeof id.name === "string") return id.name;
  const key = asNode(node.key);
  if (key?.name && typeof key.name === "string") return key.name;
  return null;
}

/**
 * Collect `var` and `function` declarations that are hoisted within their scope.
 * Order: function declarations first, then vars (matching common teaching).
 */
export function analyzeHoisting(
  ast: Program,
  source: string,
  lineMapper?: SourceLineMapper,
): HoistedBinding[] {
  const analysis = analyzeScopes(ast, source, lineMapper);
  const hoisted: HoistedBinding[] = [];
  const seen = new Set<string>();

  function walk(node: Record<string, unknown> & { type: string }) {
    switch (node.type) {
      case "FunctionDeclaration": {
        const name = functionDisplayName(node);
        const line = lineFromNode(node);
        if (name && line !== undefined) {
          const key = `fn:${name}:${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            hoisted.push({
              name,
              kind: "function",
              declarationLine: line,
              hoistedValue: `[Function: ${name}]`,
            });
          }
        }
        const body = asNode(node.body);
        if (body) walk(body);
        break;
      }

      case "VariableDeclaration": {
        if (String(node.kind ?? "var") !== "var") break;
        for (const decl of asNodeList(node.declarations)) {
          const pattern = asNode(decl.id);
          if (pattern?.type !== "Identifier") continue;
          const name = String(pattern.name ?? "");
          const line = lineFromNode(node);
          if (!name || line === undefined) continue;
          const key = `var:${name}:${line}`;
          if (seen.has(key)) continue;
          seen.add(key);
          hoisted.push({
            name,
            kind: "var",
            declarationLine: line,
            hoistedValue: "undefined",
          });
        }
        break;
      }

      case "BlockStatement":
        for (const child of asNodeList(node.body)) {
          walk(child);
        }
        break;

      case "Program":
        for (const child of asNodeList(node.body)) {
          walk(child);
        }
        break;

      case "FunctionExpression":
      case "ArrowFunctionExpression": {
        const body = asNode(node.body);
        if (body?.type === "BlockStatement") {
          for (const child of asNodeList(body.body)) {
            walk(child);
          }
        }
        break;
      }

      case "IfStatement": {
        const consequent = asNode(node.consequent);
        const alternate = asNode(node.alternate);
        if (consequent) walk(consequent);
        if (alternate) walk(alternate);
        break;
      }

      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
      case "WhileStatement":
      case "DoWhileStatement": {
        const body = asNode(node.body);
        if (body) walk(body);
        break;
      }

      default:
        break;
    }
  }

  walk(ast as unknown as Record<string, unknown> & { type: string });

  hoisted.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "function" ? -1 : 1;
    }
    return left.declarationLine - right.declarationLine;
  });

  return hoisted;
}
