import * as acorn from "acorn";
import type { Node } from "acorn";

import type { ScopeBindingKind } from "@/types/execution";

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

function asNodeList(value: unknown): AcornNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AcornNode => Boolean(item && typeof item === "object" && "type" in item));
}

function scopeSetCall(name: string, kind: ScopeBindingKind | null, valueExpr: string): string {
  const kindArg = kind === null ? "null" : JSON.stringify(kind);
  return ` __execLensScopeSet(${JSON.stringify(name)}, ${kindArg}, ${valueExpr});`;
}

function insertAfterEnd(inserts: Insert[], node: AcornNode, text: string) {
  const end = node.end;
  if (typeof end === "number") {
    inserts.push({ index: end, text });
  }
}

function collectDeclaratorSets(
  inserts: Insert[],
  node: AcornNode,
  kind: ScopeBindingKind,
) {
  const sets: string[] = [];
  for (const decl of asNodeList(node.declarations)) {
    const pattern = asNode(decl.id);
    if (pattern?.type !== "Identifier") continue;

    const name = String(pattern.name ?? "binding");
    const init = asNode(decl.init);
    const valueExpr = init
      ? name
      : `typeof ${name} === "undefined" ? undefined : ${name}`;
    sets.push(scopeSetCall(name, kind, valueExpr).trim());
  }

  if (sets.length > 0) {
    insertAfterEnd(inserts, node, ` ${sets.join(" ")}`);
  }
}

function collectParamNames(params: unknown): string[] {
  const names: string[] = [];
  for (const param of asNodeList(params)) {
    if (param.type === "Identifier") {
      names.push(String(param.name ?? "param"));
    }
  }
  return names;
}

function insertParamCapture(
  inserts: Insert[],
  source: string,
  fnNode: AcornNode,
  paramNames: string[],
) {
  if (paramNames.length === 0) return;

  const body = asNode(fnNode.body);
  if (!body || body.type !== "BlockStatement") return;

  const bodyStart = body.start;
  if (typeof bodyStart !== "number") return;

  const bodySlice = source.slice(bodyStart, (body.end as number | undefined) ?? bodyStart);
  const enterMatch = bodySlice.match(
    /^\{\s*\n\s*__execLens(?:Sync|Async)Enter\([^)]+\);\s*\n/,
  );
  const insertAt = enterMatch
    ? bodyStart + enterMatch[0].length
    : bodyStart + 1;

  const text = paramNames
    .map((name) => scopeSetCall(name, "param", name).trimStart())
    .join("\n  ");

  inserts.push({ index: insertAt, text: `  ${text}\n` });
}

function insertForInitCapture(
  inserts: Insert[],
  init: AcornNode,
  body: AcornNode,
) {
  const kind = String(init.kind ?? "let") as ScopeBindingKind;
  const names: string[] = [];
  for (const decl of asNodeList(init.declarations)) {
    const pattern = asNode(decl.id);
    if (pattern?.type !== "Identifier") continue;
    names.push(String(pattern.name ?? "binding"));
  }
  if (names.length === 0 || body.type !== "BlockStatement") return;

  const bodyStart = body.start;
  if (typeof bodyStart !== "number") return;

  const text = names
    .map((name) => scopeSetCall(name, kind, name).trimStart())
    .join("\n  ");

  inserts.push({ index: bodyStart + 1, text: `  ${text}\n` });
}

function walkStatement(inserts: Insert[], source: string, node: AcornNode) {
  switch (node.type) {
    case "VariableDeclaration":
      collectDeclaratorSets(inserts, node, String(node.kind ?? "var") as ScopeBindingKind);
      break;

    case "ExpressionStatement": {
      const expression = asNode(node.expression);
      if (expression?.type === "AssignmentExpression" && expression.operator === "=") {
        const left = asNode(expression.left);
        if (left?.type === "Identifier") {
          insertAfterEnd(
            inserts,
            node,
            scopeSetCall(String(left.name), null, String(left.name)),
          );
        }
      } else if (expression?.type === "UpdateExpression") {
        const argument = asNode(expression.argument);
        if (argument?.type === "Identifier") {
          insertAfterEnd(
            inserts,
            node,
            scopeSetCall(String(argument.name), null, String(argument.name)),
          );
        }
      }
      break;
    }

    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement": {
      const init = asNode(node.init);
      const body = asNode(node.body);
      if (init?.type === "VariableDeclaration" && body) {
        insertForInitCapture(inserts, init, body);
      }
      if (body) walkBlock(inserts, source, body);
      break;
    }

    case "FunctionDeclaration":
      insertParamCapture(inserts, source, node, collectParamNames(node.params));
      walkBlock(inserts, source, asNode(node.body));
      break;

    case "BlockStatement":
      walkBlock(inserts, source, node);
      break;

    case "IfStatement": {
      const consequent = asNode(node.consequent);
      if (consequent) walkStatement(inserts, source, consequent);
      const alternate = asNode(node.alternate);
      if (alternate) walkStatement(inserts, source, alternate);
      break;
    }

    case "WhileStatement":
    case "DoWhileStatement":
    case "LabeledStatement":
    case "WithStatement": {
      const body = asNode(node.body);
      if (body) walkStatement(inserts, source, body);
      break;
    }

    case "SwitchStatement":
      for (const switchCase of asNodeList(node.cases)) {
        for (const stmt of asNodeList(switchCase.consequent)) {
          walkStatement(inserts, source, stmt);
        }
      }
      break;

    case "TryStatement": {
      const block = asNode(node.block);
      if (block) walkStatement(inserts, source, block);
      const handler = asNode(node.handler);
      if (handler) walkStatement(inserts, source, handler);
      const finalizer = asNode(node.finalizer);
      if (finalizer) walkStatement(inserts, source, finalizer);
      break;
    }

    case "CatchClause": {
      const param = asNode(node.param);
      if (param?.type === "Identifier") {
        const body = asNode(node.body);
        if (body && typeof body.start === "number") {
          inserts.push({
            index: body.start + 1,
            text: scopeSetCall(String(param.name), "param", String(param.name)).trimStart() + "\n  ",
          });
        }
      }
      const body = asNode(node.body);
      if (body) walkBlock(inserts, source, body);
      break;
    }

    default:
      break;
  }
}

function walkBlock(inserts: Insert[], source: string, node: AcornNode | undefined) {
  if (!node) return;

  if (node.type === "BlockStatement") {
    for (const child of asNodeList(node.body)) {
      walkStatement(inserts, source, child);
    }
    return;
  }

  walkStatement(inserts, source, node);
}

function walkExpressionFunctions(inserts: Insert[], source: string, node: AcornNode) {
  switch (node.type) {
    case "FunctionExpression":
      insertParamCapture(inserts, source, node, collectParamNames(node.params));
      walkBlock(inserts, source, asNode(node.body));
      break;

    case "ArrowFunctionExpression": {
      insertParamCapture(inserts, source, node, collectParamNames(node.params));
      const body = asNode(node.body);
      if (body?.type === "BlockStatement") {
        walkBlock(inserts, source, body);
      }
      break;
    }

    case "CallExpression":
    case "NewExpression": {
      const callee = asNode(node.callee);
      if (callee) walkExpressionFunctions(inserts, source, callee);
      for (const arg of asNodeList(node.arguments)) {
        walkExpressionFunctions(inserts, source, arg);
      }
      break;
    }

    case "VariableDeclaration":
      for (const decl of asNodeList(node.declarations)) {
        const init = asNode(decl.init);
        if (init) walkExpressionFunctions(inserts, source, init);
      }
      break;

    case "AssignmentExpression":
    case "BinaryExpression":
    case "LogicalExpression":
    case "ConditionalExpression": {
      const left = asNode(node.left);
      const right = asNode(node.right);
      if (left) walkExpressionFunctions(inserts, source, left);
      if (right) walkExpressionFunctions(inserts, source, right);
      break;
    }

    case "UnaryExpression":
    case "AwaitExpression":
    case "SpreadElement":
    case "UpdateExpression": {
      const argument = asNode(node.argument);
      if (argument) walkExpressionFunctions(inserts, source, argument);
      break;
    }

    case "ArrayExpression":
      for (const element of asNodeList(node.elements)) {
        walkExpressionFunctions(inserts, source, element);
      }
      break;

    case "ObjectExpression":
      for (const prop of asNodeList(node.properties)) {
        const value = asNode(prop.value);
        if (value) walkExpressionFunctions(inserts, source, value);
      }
      break;

    case "MemberExpression": {
      const object = asNode(node.object);
      if (object) walkExpressionFunctions(inserts, source, object);
      break;
    }

    default:
      break;
  }
}

/**
 * Inject `__execLensScopeSet` calls after declarations, assignments, and function entry.
 *
 * Approach (Phase 3.2): AST-guided source instrumentation — not a Proxy/`with` wrapper.
 * At each binding write the runner stores `{ name, kind, value }` on the active call-stack
 * frame; `snapshot()` copies those maps into `ExecutionStep.scopes`.
 */
export function instrumentScopeTracking(source: string): string {
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

  for (const statement of asNodeList(ast.body)) {
    walkStatement(inserts, source, statement);
    walkExpressionFunctions(inserts, source, statement);
  }

  if (inserts.length === 0) return source;

  inserts.sort((left, right) => right.index - left.index);

  let result = source;
  for (const insert of inserts) {
    result = result.slice(0, insert.index) + insert.text + result.slice(insert.index);
  }

  return result;
}
