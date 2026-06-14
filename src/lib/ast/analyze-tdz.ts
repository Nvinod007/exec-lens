import type { Program } from "acorn";

import { analyzeScopes } from "@/lib/ast/analyze-scopes";
import type { SourceLineMapper } from "@/lib/ast/source-map";
import type { BindingInfo, ScopeInfo } from "@/lib/ast/types";

type AcornNode = Record<string, unknown> & { type: string };

export interface TdzViolation {
  name: string;
  referenceLine: number;
  declarationLine: number;
  kind: "let" | "const";
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

function isTypeofIdentifier(node: AcornNode, parent: AcornNode | undefined): boolean {
  return (
    parent?.type === "UnaryExpression" &&
    parent.operator === "typeof" &&
    parent.argument === node
  );
}

interface WalkState {
  scopeStack: string[];
  bindingsByScope: Map<string, BindingInfo[]>;
  scopesById: Map<string, ScopeInfo>;
  references: Array<{ name: string; line: number; scopeId: string }>;
}

function currentScopeId(state: WalkState): string {
  return state.scopeStack[state.scopeStack.length - 1] ?? "scope-0";
}

function pushScope(state: WalkState, scopeId: string) {
  state.scopeStack.push(scopeId);
}

function popScope(state: WalkState) {
  state.scopeStack.pop();
}

function recordReference(state: WalkState, name: string, line: number) {
  if (!name || line <= 0) return;
  state.references.push({ name, line, scopeId: currentScopeId(state) });
}

function walkNode(state: WalkState, node: AcornNode, parent?: AcornNode) {
  switch (node.type) {
    case "Program":
      for (const child of asNodeList(node.body)) {
        walkNode(state, child, node);
      }
      break;

    case "BlockStatement": {
      const scope = findScopeForLine(state, lineFromNode(node));
      if (scope) pushScope(state, scope.id);
      for (const child of asNodeList(node.body)) {
        walkNode(state, child, node);
      }
      if (scope) popScope(state);
      break;
    }

    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression": {
      const scope = findScopeForLine(state, lineFromNode(node));
      if (scope) pushScope(state, scope.id);
      const body = asNode(node.body);
      if (body) walkNode(state, body, node);
      if (scope) popScope(state);
      break;
    }

    case "VariableDeclaration": {
      for (const decl of asNodeList(node.declarations)) {
        const init = asNode(decl.init);
        if (init) walkNode(state, init, decl);
      }
      break;
    }

    case "VariableDeclarator": {
      const init = asNode(node.init);
      if (init) walkNode(state, init, node);
      break;
    }

    case "Identifier": {
      if (isTypeofIdentifier(node, parent)) break;
      const line = lineFromNode(node);
      if (line !== undefined) {
        recordReference(state, String(node.name ?? ""), line);
      }
      break;
    }

    case "AssignmentExpression": {
      const left = asNode(node.left);
      const right = asNode(node.right);
      if (right) walkNode(state, right, node);
      if (left?.type === "Identifier") {
        const line = lineFromNode(left);
        if (line !== undefined) {
          recordReference(state, String(left.name ?? ""), line);
        }
      } else if (left) {
        walkNode(state, left, node);
      }
      break;
    }

    case "UpdateExpression": {
      const argument = asNode(node.argument);
      if (argument?.type === "Identifier") {
        const line = lineFromNode(argument);
        if (line !== undefined) {
          recordReference(state, String(argument.name ?? ""), line);
        }
      }
      break;
    }

    case "MemberExpression": {
      const object = asNode(node.object);
      if (object) walkNode(state, object, node);
      if (node.computed) {
        const property = asNode(node.property);
        if (property) walkNode(state, property, node);
      }
      break;
    }

    case "Property": {
      const value = asNode(node.value);
      if (value) walkNode(state, value, node);
      break;
    }

    case "IfStatement": {
      const test = asNode(node.test);
      const consequent = asNode(node.consequent);
      const alternate = asNode(node.alternate);
      if (test) walkNode(state, test, node);
      if (consequent) walkNode(state, consequent, node);
      if (alternate) walkNode(state, alternate, node);
      break;
    }

    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement":
    case "WhileStatement":
    case "DoWhileStatement": {
      const body = asNode(node.body);
      if (body) walkNode(state, body, node);
      break;
    }

    default:
      for (const key of Object.keys(node)) {
        if (key === "type" || key === "loc" || key === "start" || key === "end") continue;
        const value = node[key];
        if (Array.isArray(value)) {
          for (const child of value) {
            const childNode = asNode(child);
            if (childNode) walkNode(state, childNode, node);
          }
        } else {
          const childNode = asNode(value);
          if (childNode) walkNode(state, childNode, node);
        }
      }
      break;
  }
}

function findScopeForLine(
  state: WalkState,
  line: number | undefined,
): ScopeInfo | undefined {
  if (line === undefined) return undefined;

  let best: ScopeInfo | undefined;
  for (const scope of state.scopesById.values()) {
    if (line >= scope.start.line && line <= scope.end.line) {
      if (!best || scope.start.line >= best.start.line) {
        best = scope;
      }
    }
  }
  return best;
}

/**
 * Detect `let`/`const` reads before their declaration line (temporal dead zone).
 */
export function analyzeTdz(
  ast: Program,
  source: string,
  lineMapper?: SourceLineMapper,
): TdzViolation[] {
  const analysis = analyzeScopes(ast, source, lineMapper);
  const scopesById = new Map(analysis.scopes.map((scope) => [scope.id, scope]));
  const bindingsByScope = new Map<string, BindingInfo[]>();

  for (const binding of analysis.bindings) {
    const list = bindingsByScope.get(binding.scopeId) ?? [];
    list.push(binding);
    bindingsByScope.set(binding.scopeId, list);
  }

  const globalScope = analysis.scopes.find((scope) => scope.kind === "global");
  const state: WalkState = {
    scopeStack: globalScope ? [globalScope.id] : [],
    bindingsByScope,
    scopesById,
    references: [],
  };

  walkNode(state, ast as unknown as AcornNode);

  const violations: TdzViolation[] = [];
  const seen = new Set<string>();

  for (const ref of state.references) {
    const binding = resolveBinding(ref.name, ref.scopeId, bindingsByScope, scopesById);
    if (!binding || (binding.kind !== "let" && binding.kind !== "const")) continue;
    if (ref.line >= binding.start.line) continue;

    const key = `${ref.name}:${ref.line}`;
    if (seen.has(key)) continue;
    seen.add(key);

    violations.push({
      name: ref.name,
      referenceLine: ref.line,
      declarationLine: binding.start.line,
      kind: binding.kind,
    });
  }

  return violations.sort((left, right) => left.referenceLine - right.referenceLine);
}
