import type { Program } from "acorn";

import { analyzeScopes } from "@/lib/ast/analyze-scopes";
import type { SourceLineMapper } from "@/lib/ast/source-map";
import type { BindingInfo, FunctionBoundary, ScopeInfo } from "@/lib/ast/types";

type AcornNode = Record<string, unknown> & { type: string };

export interface CapturedBinding {
  name: string;
  kind: BindingInfo["kind"];
}

export interface ClosureSite {
  /** Function label for teaching — variable name or "anonymous". */
  label: string;
  /** 1-based line where the function value is created. */
  line: number;
  captured: CapturedBinding[];
}

function asNode(value: unknown): AcornNode | undefined {
  if (value && typeof value === "object" && "type" in value) {
    return value as AcornNode;
  }
  return undefined;
}

function asNodeList(value: unknown): AcornNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AcornNode => Boolean(item && typeof item === "object" && "type" in item));
}

function lineFromNode(node: AcornNode): number | undefined {
  const loc = node.loc as { start: { line: number } } | null | undefined;
  return loc?.start.line;
}

function resolveBinding(
  name: string,
  fromScopeId: string,
  bindingsByScope: Map<string, BindingInfo[]>,
  scopesById: Map<string, ScopeInfo>,
): BindingInfo | undefined {
  let current: string | null = fromScopeId;
  while (current) {
    const scopeBindings = bindingsByScope.get(current) ?? [];
    const match = scopeBindings.find((binding) => binding.name === name);
    if (match) return match;
    current = scopesById.get(current)?.parentId ?? null;
  }
  return undefined;
}

function isAncestorScope(
  ancestorId: string,
  scopeId: string,
  scopesById: Map<string, ScopeInfo>,
): boolean {
  let current: string | null = scopeId;
  while (current) {
    if (current === ancestorId) return true;
    current = scopesById.get(current)?.parentId ?? null;
  }
  return false;
}

function collectFreeVariables(
  fnNode: AcornNode,
  fnScopeId: string,
  bindingsByScope: Map<string, BindingInfo[]>,
  scopesById: Map<string, ScopeInfo>,
): CapturedBinding[] {
  const refs = new Set<string>();

  function walk(node: AcornNode, scopeId: string) {
    switch (node.type) {
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        return;

      case "BlockStatement": {
        for (const child of asNodeList(node.body)) {
          walk(child, scopeId);
        }
        break;
      }

      case "VariableDeclaration": {
        for (const decl of asNodeList(node.declarations)) {
          const init = asNode(decl.init);
          if (init) walk(init, scopeId);
        }
        break;
      }

      case "Identifier": {
        refs.add(String(node.name ?? ""));
        break;
      }

      case "AssignmentExpression": {
        const left = asNode(node.left);
        const right = asNode(node.right);
        if (right) walk(right, scopeId);
        if (left?.type === "Identifier") {
          refs.add(String(left.name ?? ""));
        } else if (left) {
          walk(left, scopeId);
        }
        break;
      }

      case "UpdateExpression": {
        const argument = asNode(node.argument);
        if (argument?.type === "Identifier") {
          refs.add(String(argument.name ?? ""));
        }
        break;
      }

      case "MemberExpression": {
        const object = asNode(node.object);
        if (object) walk(object, scopeId);
        if (node.computed) {
          const property = asNode(node.property);
          if (property) walk(property, scopeId);
        }
        break;
      }

      case "Property": {
        const value = asNode(node.value);
        if (value) walk(value, scopeId);
        break;
      }

      default:
        for (const key of Object.keys(node)) {
          if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
          const value = node[key];
          if (Array.isArray(value)) {
            for (const child of value) {
              const childNode = asNode(child);
              if (childNode) walk(childNode, scopeId);
            }
          } else {
            const childNode = asNode(value);
            if (childNode) walk(childNode, scopeId);
          }
        }
        break;
    }
  }

  const body = asNode(fnNode.body);
  if (body?.type === "BlockStatement") {
    walk(body, fnScopeId);
  } else if (body) {
    walk(body, fnScopeId);
  }

  const captured: CapturedBinding[] = [];
  const seen = new Set<string>();

  for (const name of refs) {
    if (!name || seen.has(name)) continue;

    const binding = resolveBinding(name, fnScopeId, bindingsByScope, scopesById);
    if (!binding) continue;
    if (binding.scopeId === fnScopeId) continue;
    if (!isAncestorScope(binding.scopeId, fnScopeId, scopesById)) continue;

    seen.add(name);
    captured.push({ name, kind: binding.kind });
  }

  return captured.sort((left, right) => left.name.localeCompare(right.name));
}

function inferFunctionLabel(fnNode: AcornNode, parent: AcornNode | undefined): string {
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

function findFunctionNode(
  ast: Program,
  fn: FunctionBoundary,
): { node: AcornNode; parent: AcornNode | undefined } | undefined {
  let found: { node: AcornNode; parent: AcornNode | undefined } | undefined;

  function walk(node: AcornNode, parent: AcornNode | undefined) {
    if (found) return;
    const line = lineFromNode(node);
    if (
      line === fn.start.line &&
      (node.type === "FunctionDeclaration" ||
        node.type === "FunctionExpression" ||
        node.type === "ArrowFunctionExpression")
    ) {
      found = { node, parent };
      return;
    }

    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc") continue;
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

  walk(ast as unknown as AcornNode, undefined);
  return found;
}

/** Find inner functions that close over outer bindings. */
export function analyzeClosures(
  ast: Program,
  source: string,
  lineMapper?: SourceLineMapper,
): ClosureSite[] {
  const analysis = analyzeScopes(ast, source, lineMapper);
  const scopesById = new Map(analysis.scopes.map((scope) => [scope.id, scope]));
  const bindingsByScope = new Map<string, BindingInfo[]>();

  for (const binding of analysis.bindings) {
    const list = bindingsByScope.get(binding.scopeId) ?? [];
    list.push(binding);
    bindingsByScope.set(binding.scopeId, list);
  }

  const sites: ClosureSite[] = [];

  for (const fn of analysis.functions) {
    const fnScope = scopesById.get(fn.scopeId);
    const parentScope = fnScope?.parentId ? scopesById.get(fnScope.parentId) : undefined;
    if (fn.kind === "declaration" && parentScope?.kind === "global") continue;

    const located = findFunctionNode(ast, fn);
    if (!located) continue;

    const captured = collectFreeVariables(
      located.node,
      fn.scopeId,
      bindingsByScope,
      scopesById,
    );
    if (captured.length === 0) continue;

    sites.push({
      label: inferFunctionLabel(located.node, located.parent),
      line: fn.start.line,
      captured,
    });
  }

  return sites.sort((left, right) => left.line - right.line);
}
