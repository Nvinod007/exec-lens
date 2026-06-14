import type { Node, Program } from "acorn";

import type {
  BindingInfo,
  BindingKind,
  FunctionBoundary,
  FunctionKind,
  ScopeInfo,
  ScopeKind,
  SourceAnalysis,
  SourcePosition,
} from "@/lib/ast/types";
import type { SourceLineMapper } from "@/lib/ast/source-map";

type AcornNode = Node & Record<string, unknown>;

interface WalkState {
  scopes: ScopeInfo[];
  bindings: BindingInfo[];
  functions: FunctionBoundary[];
  scopeCounter: number;
  scopeStack: string[];
  source: string;
  lineMapper?: SourceLineMapper;
  remapPositions: boolean;
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

function nodeName(node: AcornNode): string | null {
  const id = asNode(node.id);
  if (id?.name && typeof id.name === "string") return id.name;
  const key = asNode(node.key);
  if (key?.name && typeof key.name === "string") return key.name;
  return null;
}

function positionFromLoc(node: AcornNode, state: WalkState): SourcePosition | undefined {
  const loc = node.loc as
    | { start: { line: number; column: number }; end: { line: number; column: number } }
    | null
    | undefined;
  if (!loc) return undefined;

  if (!state.remapPositions || !state.lineMapper) {
    return { line: loc.start.line, column: loc.start.column };
  }

  return state.lineMapper.toEditorPosition(loc.start.line, loc.start.column);
}

function endPositionFromLoc(node: AcornNode, state: WalkState): SourcePosition | undefined {
  const loc = node.loc as
    | { start: { line: number; column: number }; end: { line: number; column: number } }
    | null
    | undefined;
  if (!loc) return undefined;

  if (!state.remapPositions || !state.lineMapper) {
    return { line: loc.end.line, column: loc.end.column };
  }

  return state.lineMapper.toEditorPosition(loc.end.line, loc.end.column);
}

function createScopeId(state: WalkState): string {
  state.scopeCounter += 1;
  return `scope-${state.scopeCounter}`;
}

function pushScope(
  state: WalkState,
  kind: ScopeKind,
  start: SourcePosition,
  end: SourcePosition,
): string {
  const id = createScopeId(state);
  const parentId = state.scopeStack[state.scopeStack.length - 1] ?? null;
  state.scopes.push({ id, kind, parentId, start, end });
  state.scopeStack.push(id);
  return id;
}

function popScope(state: WalkState) {
  state.scopeStack.pop();
}

function currentScopeId(state: WalkState): string {
  return state.scopeStack[state.scopeStack.length - 1] ?? "scope-0";
}

function recordBinding(
  state: WalkState,
  name: string,
  kind: BindingKind,
  node: AcornNode,
) {
  const start = positionFromLoc(node, state);
  if (!start) return;

  state.bindings.push({
    name,
    kind,
    scopeId: currentScopeId(state),
    start,
  });
}

function recordFunction(
  state: WalkState,
  node: AcornNode,
  kind: FunctionKind,
  name: string | null,
  scopeId: string,
) {
  const start = positionFromLoc(node, state);
  const end = endPositionFromLoc(node, state);
  const body = asNode(node.body);
  const bodyStart = body ? positionFromLoc(body, state) : start;
  if (!start || !end || !bodyStart) return;

  state.functions.push({
    name,
    kind,
    scopeId,
    start,
    end,
    bodyStart,
  });
}

function walkParams(state: WalkState, params: unknown) {
  for (const param of asNodeList(params)) {
    collectParamBindings(state, param);
  }
}

function collectParamBindings(state: WalkState, node: AcornNode) {
  switch (node.type) {
    case "Identifier":
      recordBinding(state, String(node.name ?? "param"), "param", node);
      break;
    case "AssignmentPattern": {
      const left = asNode(node.left);
      if (left?.type === "Identifier") {
        recordBinding(state, String(left.name ?? "param"), "param", left);
      }
      break;
    }
    case "RestElement": {
      const argument = asNode(node.argument);
      if (argument?.type === "Identifier") {
        recordBinding(state, String(argument.name ?? "rest"), "param", argument);
      }
      break;
    }
    default:
      break;
  }
}

function walkFunction(
  state: WalkState,
  node: AcornNode,
  kind: FunctionKind,
  name: string | null,
) {
  const start = positionFromLoc(node, state);
  const end = endPositionFromLoc(node, state);
  if (!start || !end) return;

  const scopeId = pushScope(state, "function", start, end);
  recordFunction(state, node, kind, name, scopeId);
  walkParams(state, node.params);
  const body = asNode(node.body);
  if (body) walkNode(state, body);
  popScope(state);
}

function walkBlock(state: WalkState, node: AcornNode) {
  const start = positionFromLoc(node, state);
  const end = endPositionFromLoc(node, state);
  if (!start || !end) return;

  pushScope(state, "block", start, end);
  for (const child of asNodeList(node.body)) {
    walkNode(state, child);
  }
  popScope(state);
}

function walkNode(state: WalkState, node: AcornNode) {
  switch (node.type) {
    case "Program":
      for (const child of asNodeList(node.body)) {
        walkNode(state, child);
      }
      break;

    case "FunctionDeclaration":
      walkFunction(state, node, "declaration", nodeName(node));
      break;

    case "FunctionExpression":
      walkFunction(state, node, "expression", nodeName(node));
      break;

    case "ArrowFunctionExpression":
      walkFunction(state, node, "arrow", null);
      break;

    case "VariableDeclaration": {
      const bindingKind = String(node.kind ?? "var") as BindingKind;
      for (const decl of asNodeList(node.declarations)) {
        const pattern = asNode(decl.id);
        if (pattern) collectPatternBinding(state, pattern, bindingKind);
        const init = asNode(decl.init);
        if (init) walkNode(state, init);
      }
      break;
    }

    case "BlockStatement":
      walkBlock(state, node);
      break;

    case "IfStatement": {
      const consequent = asNode(node.consequent);
      const alternate = asNode(node.alternate);
      if (consequent) walkNode(state, consequent);
      if (alternate) walkNode(state, alternate);
      break;
    }

    case "ForStatement": {
      const init = asNode(node.init);
      const test = asNode(node.test);
      const update = asNode(node.update);
      if (init?.type === "VariableDeclaration") {
        const bindingKind = String(init.kind ?? "var") as BindingKind;
        for (const decl of asNodeList(init.declarations)) {
          const pattern = asNode(decl.id);
          if (pattern) collectPatternBinding(state, pattern, bindingKind);
          const initExpr = asNode(decl.init);
          if (initExpr) walkNode(state, initExpr);
        }
      } else if (init) {
        walkNode(state, init);
      }
      if (test) walkNode(state, test);
      if (update) walkNode(state, update);
      const body = asNode(node.body);
      if (body) walkNode(state, body);
      break;
    }

    case "ForInStatement":
    case "ForOfStatement": {
      const left = asNode(node.left);
      if (left?.type === "VariableDeclaration") {
        const bindingKind = String(left.kind ?? "var") as BindingKind;
        for (const decl of asNodeList(left.declarations)) {
          const pattern = asNode(decl.id);
          if (pattern) collectPatternBinding(state, pattern, bindingKind);
        }
      }
      const body = asNode(node.body);
      if (body) walkNode(state, body);
      break;
    }

    case "WhileStatement":
    case "DoWhileStatement": {
      const body = asNode(node.body);
      if (body) walkNode(state, body);
      break;
    }

    case "SwitchStatement":
      for (const switchCase of asNodeList(node.cases)) {
        for (const stmt of asNodeList(switchCase.consequent)) {
          walkNode(state, stmt);
        }
      }
      break;

    case "TryStatement": {
      const block = asNode(node.block);
      const handler = asNode(node.handler);
      const finalizer = asNode(node.finalizer);
      if (block) walkNode(state, block);
      if (handler) walkNode(state, handler);
      if (finalizer) walkNode(state, finalizer);
      break;
    }

    case "CatchClause": {
      const param = asNode(node.param);
      if (param?.type === "Identifier") {
        recordBinding(state, String(param.name ?? "catch"), "param", param);
      }
      const body = asNode(node.body);
      if (body) walkNode(state, body);
      break;
    }

    case "ExpressionStatement": {
      const expression = asNode(node.expression);
      if (expression) walkNode(state, expression);
      break;
    }

    case "ReturnStatement": {
      const argument = asNode(node.argument);
      if (argument) walkNode(state, argument);
      break;
    }

    case "CallExpression":
    case "NewExpression": {
      const callee = asNode(node.callee);
      if (callee) walkNode(state, callee);
      for (const arg of asNodeList(node.arguments)) {
        walkNode(state, arg);
      }
      break;
    }

    case "MemberExpression": {
      const object = asNode(node.object);
      const property = asNode(node.property);
      if (object) walkNode(state, object);
      if (property && !node.computed) walkNode(state, property);
      break;
    }

    case "BinaryExpression":
    case "LogicalExpression":
    case "AssignmentExpression": {
      const left = asNode(node.left);
      const right = asNode(node.right);
      if (left) walkNode(state, left);
      if (right) walkNode(state, right);
      break;
    }

    case "ConditionalExpression": {
      const test = asNode(node.test);
      const consequent = asNode(node.consequent);
      const alternate = asNode(node.alternate);
      if (test) walkNode(state, test);
      if (consequent) walkNode(state, consequent);
      if (alternate) walkNode(state, alternate);
      break;
    }

    case "UnaryExpression":
    case "UpdateExpression":
    case "AwaitExpression":
    case "SpreadElement": {
      const argument = asNode(node.argument);
      if (argument) walkNode(state, argument);
      break;
    }

    case "ArrayExpression":
      for (const element of asNodeList(node.elements)) {
        walkNode(state, element);
      }
      break;

    case "ObjectExpression":
      for (const prop of asNodeList(node.properties)) {
        walkNode(state, prop);
      }
      break;

    case "Property": {
      const value = asNode(node.value);
      if (value) walkNode(state, value);
      break;
    }

    case "ClassDeclaration":
    case "ClassExpression": {
      const body = asNode(node.body);
      if (body) walkNode(state, body);
      break;
    }

    case "MethodDefinition": {
      const value = asNode(node.value);
      if (value) walkFunction(state, value, "method", nodeName(node));
      break;
    }

    default:
      break;
  }
}

function collectPatternBinding(
  state: WalkState,
  node: AcornNode,
  kind: BindingKind,
) {
  switch (node.type) {
    case "Identifier":
      recordBinding(state, String(node.name ?? "binding"), kind, node);
      break;
    case "ObjectPattern":
      for (const prop of asNodeList(node.properties)) {
        collectPatternBinding(state, prop, kind);
      }
      break;
    case "Property": {
      const value = asNode(node.value);
      if (value) collectPatternBinding(state, value, kind);
      break;
    }
    case "ArrayPattern":
      for (const element of asNodeList(node.elements)) {
        collectPatternBinding(state, element, kind);
      }
      break;
    case "RestElement": {
      const argument = asNode(node.argument);
      if (argument) collectPatternBinding(state, argument, kind);
      break;
    }
    default:
      break;
  }
}

/**
 * Walk an Acorn program and collect scopes, bindings, and function boundaries.
 * When `lineMapper` is set (TS compile path), positions are remapped to editor lines.
 */
export function analyzeScopes(
  ast: Program,
  source: string,
  lineMapper?: SourceLineMapper,
): SourceAnalysis {
  const programEnd = source.split("\n").length;
  const state: WalkState = {
    scopes: [],
    bindings: [],
    functions: [],
    scopeCounter: 0,
    scopeStack: [],
    source,
    lineMapper,
    remapPositions: lineMapper !== undefined,
  };

  pushScope(state, "global", { line: 1, column: 0 }, { line: programEnd, column: 0 });

  walkNode(state, ast as unknown as AcornNode);
  popScope(state);

  return {
    scopes: state.scopes,
    bindings: state.bindings,
    functions: state.functions,
  };
}
