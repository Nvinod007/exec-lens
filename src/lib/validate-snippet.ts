import * as acorn from "acorn";

export interface SyntaxIssue {
  message: string;
  line: number;
  column: number;
}

/** Parse JS with acorn — returns the first syntax error with line/column. */
export function validateJavaScript(source: string): SyntaxIssue | null {
  try {
    acorn.parse(source, {
      ecmaVersion: "latest",
      sourceType: "script",
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
    });
    return null;
  } catch (error) {
    return parseSyntaxError(error);
  }
}

/** Normalize acorn / esbuild syntax errors into line + column. */
export function parseSyntaxError(error: unknown): SyntaxIssue | null {
  if (!(error instanceof Error)) return null;

  const withLoc = error as Error & {
    loc?: { line: number; column: number };
    location?: { line: number; column: number };
  };

  if (withLoc.loc) {
    return {
      message: withLoc.message,
      line: withLoc.loc.line,
      column: withLoc.loc.column,
    };
  }

  if (withLoc.location) {
    return {
      message: withLoc.message,
      line: withLoc.location.line,
      column: withLoc.location.column,
    };
  }

  const match = error.message.match(/:(\d+):(\d+)/);
  if (match) {
    return {
      message: error.message,
      line: Number(match[1]),
      column: Number(match[2]),
    };
  }

  return { message: error.message, line: 1, column: 0 };
}

export function formatSyntaxIssue(issue: SyntaxIssue): string {
  return `Line ${issue.line}: ${issue.message}`;
}
