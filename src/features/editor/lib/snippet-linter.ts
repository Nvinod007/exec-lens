import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";

import {
  parseSyntaxError,
  validateJavaScript,
  type SyntaxIssue,
} from "@/lib/validate-snippet";

function issueToDiagnostic(doc: EditorView["state"]["doc"], issue: SyntaxIssue): Diagnostic {
  const lineNumber = Math.min(Math.max(issue.line, 1), doc.lines);
  const line = doc.line(lineNumber);
  const from = Math.min(line.from + issue.column, line.to);
  const to = Math.min(from + 1, line.to);

  return {
    from,
    to: to > from ? to : from + 1,
    severity: "error",
    message: issue.message,
  };
}

let validateTimer: ReturnType<typeof setTimeout> | undefined;
let validateRequest = 0;

/** Debounced TypeScript check via esbuild on the server. */
async function validateTypeScript(source: string): Promise<SyntaxIssue | null> {
  const requestId = ++validateRequest;

  return new Promise((resolve) => {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(async () => {
      try {
        const response = await fetch("/api/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: source, language: "typescript" }),
        });

        if (requestId !== validateRequest) return resolve(null);

        const data = (await response.json()) as {
          ok?: boolean;
          line?: number;
          column?: number;
          message?: string;
        };

        if (data.ok) return resolve(null);
        if (data.line != null && data.message) {
          return resolve({
            line: data.line,
            column: data.column ?? 0,
            message: data.message,
          });
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    }, 350);
  });
}

/** Live syntax lint — acorn for JS, debounced esbuild for TS. */
export function createSnippetLinter(language: "javascript" | "typescript") {
  return linter(
    async (view: EditorView): Promise<Diagnostic[]> => {
      const source = view.state.doc.toString();
      if (!source.trim()) return [];

      if (language === "javascript") {
        const issue = validateJavaScript(source);
        return issue ? [issueToDiagnostic(view.state.doc, issue)] : [];
      }

      const tsIssue = await validateTypeScript(source);
      if (!tsIssue) return [];
      return [issueToDiagnostic(view.state.doc, tsIssue)];
    },
    { delay: language === "javascript" ? 200 : 400 },
  );
}

export { parseSyntaxError, issueToDiagnostic };
