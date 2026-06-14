"use client";

import { javascript } from "@codemirror/lang-javascript";
import { lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { useEffect, useRef } from "react";

import { createBreakpointGutter } from "@/features/editor/lib/breakpoint-gutter";
import { createSnippetLinter } from "@/features/editor/lib/snippet-linter";
import {
  setStepLineEffect,
  stepLineField,
} from "@/features/editor/lib/step-line-highlight";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: "javascript" | "typescript";
  activeLine?: number;
  errorLine?: number;
  breakpoints?: number[];
  onToggleBreakpoint?: (line: number) => void;
  readOnly?: boolean;
}

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "var(--editor-bg)",
    color: "var(--editor-fg)",
  },
  ".cm-scroller": { fontFamily: "var(--font-geist-mono)" },
  ".cm-gutters": {
    backgroundColor: "var(--editor-gutter)",
    color: "var(--editor-gutter-fg)",
    border: "none",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--editor-active)",
    color: "var(--editor-fg)",
    fontWeight: "600",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--editor-active)",
  },
  ".cm-stepLine": {
    backgroundColor: "var(--editor-active)",
  },
  ".cm-content": { caretColor: "var(--editor-fg)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--editor-fg)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    backgroundColor: "color-mix(in oklch, var(--destructive) 22%, transparent)",
    borderBottom: "2px wavy var(--destructive)",
  },
  ".cm-breakpoint-gutter": { width: "14px" },
  ".cm-breakpoint-dot": {
    display: "block",
    width: "10px",
    height: "10px",
    margin: "0 auto",
    borderRadius: "9999px",
    background: "#ef4444",
    cursor: "pointer",
  },
  ".cm-lineNumbers .cm-gutterElement": { cursor: "pointer" },
});

/** CodeMirror editor with lint, breakpoints, and step highlight. */
export function CodeEditor({
  value,
  onChange,
  language,
  activeLine,
  errorLine,
  breakpoints = [],
  onToggleBreakpoint,
  readOnly = false,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const breakpointsRef = useRef(breakpoints);
  const onToggleRef = useRef(onToggleBreakpoint);

  onChangeRef.current = onChange;
  breakpointsRef.current = breakpoints;
  onToggleRef.current = onToggleBreakpoint;

  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        lintGutter(),
        ...(onToggleRef.current
          ? createBreakpointGutter(
              () => breakpointsRef.current,
              (line) => onToggleRef.current?.(line),
            )
          : []),
        createSnippetLinter(language),
        highlightActiveLineGutter(),
        stepLineField,
        javascript({ typescript: true }),
        editorTheme,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });

    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current !== value && !view.hasFocus) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({});
  }, [breakpoints]);

  const highlightLine = errorLine ?? activeLine;

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: setStepLineEffect.of(highlightLine),
    });

    if (!highlightLine || view.hasFocus) return;

    const line = view.state.doc.line(
      Math.min(Math.max(highlightLine, 1), view.state.doc.lines),
    );
    view.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
  }, [highlightLine]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 overflow-hidden rounded-lg border border-border/60"
    />
  );
}
