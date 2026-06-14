/** Discriminant for lexical / function scopes discovered by the AST walk. */
export type ScopeKind = "global" | "function" | "block";

/** 1-based line and 0-based column in editor source. */
export interface SourcePosition {
  line: number;
  column: number;
}

/** A lexical scope region in the user program. */
export interface ScopeInfo {
  id: string;
  kind: ScopeKind;
  parentId: string | null;
  start: SourcePosition;
  end: SourcePosition;
}

/** Variable / parameter binding inside a scope. */
export type BindingKind = "var" | "let" | "const" | "param" | "function";

export interface BindingInfo {
  name: string;
  kind: BindingKind;
  scopeId: string;
  start: SourcePosition;
}

/** How a callable was declared in source. */
export type FunctionKind = "declaration" | "expression" | "arrow" | "method";

/** Function body boundaries — used by closure / scope teaching in later phases. */
export interface FunctionBoundary {
  name: string | null;
  kind: FunctionKind;
  scopeId: string;
  start: SourcePosition;
  end: SourcePosition;
  bodyStart: SourcePosition;
}

/** Result of a full AST scope walk. */
export interface SourceAnalysis {
  scopes: ScopeInfo[];
  bindings: BindingInfo[];
  functions: FunctionBoundary[];
}
