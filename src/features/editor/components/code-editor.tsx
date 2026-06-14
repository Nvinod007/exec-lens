"use client";

import { javascript } from "@codemirror/lang-javascript";
import { lintGutter } from "@codemirror/lint";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLineGutter } from "@codemirror/view";
import { useCallback, useEffect, useRef } from "react";

import { createBreakpointGutter } from "@/features/editor/lib/breakpoint-gutter";
import {
  createEditorShortcutKeymap,
  type EditorShortcutHandlers,
} from "@/features/editor/lib/editor-shortcut-keymap";
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
  editorShortcuts?: EditorShortcutHandlers;
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
    backgroundColor: "var(--editor-active) !important",
    boxShadow: "inset 3px 0 0 var(--primary)",
  },
  ".cm-content": { caretColor: "var(--editor-fg)" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "var(--editor-fg)" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    backgroundColor: "color-mix(in oklch, var(--destructive) 22%, transparent)",
    borderBottom: "2px wavy var(--destructive)",
  },
  ".cm-lintRange-active": {
    backgroundColor: "color-mix(in oklch, var(--destructive) 14%, transparent)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    boxShadow: "0 4px 12px rgb(0 0 0 / 18%)",
  },
  ".cm-tooltip-lint": {
    padding: 0,
    margin: 0,
  },
  ".cm-diagnostic": {
    color: "var(--popover-foreground)",
  },
  ".cm-diagnostic-error": {
    borderLeftColor: "var(--destructive)",
  },
  ".cm-diagnostic-warning": {
    borderLeftColor: "var(--macrotask)",
  },
  ".cm-diagnostic-info": {
    borderLeftColor: "var(--muted-foreground)",
  },
  ".cm-diagnosticAction": {
    backgroundColor: "var(--secondary)",
    color: "var(--secondary-foreground)",
  },
  ".cm-diagnosticSource": {
    color: "var(--muted-foreground)",
    opacity: 1,
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
  editorShortcuts,
  readOnly = false,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const breakpointsRef = useRef(breakpoints);
  const onToggleRef = useRef(onToggleBreakpoint);
  const editorShortcutsRef = useRef(editorShortcuts);
  const highlightLineRef = useRef<number | undefined>(undefined);

  onChangeRef.current = onChange;
  breakpointsRef.current = breakpoints;
  onToggleRef.current = onToggleBreakpoint;
  editorShortcutsRef.current = editorShortcuts;

  const highlightLine = errorLine ?? activeLine;
  highlightLineRef.current = highlightLine;

  const applyStepHighlight = useCallback((view: EditorView, line: number | undefined) => {
    view.dispatch({
      effects: setStepLineEffect.of(line),
    });

    if (!line || line < 1 || line > view.state.doc.lines || view.hasFocus) return;

    const docLine = view.state.doc.line(line);
    view.dispatch({
      effects: EditorView.scrollIntoView(docLine.from, { y: "center" }),
    });
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;

    const shortcutKeymap = createEditorShortcutKeymap({
      onRun: () => editorShortcutsRef.current?.onRun?.(),
      runDisabled: () => editorShortcutsRef.current?.runDisabled?.() ?? false,
      onPlayToggle: () => editorShortcutsRef.current?.onPlayToggle?.(),
      onFirst: () => editorShortcutsRef.current?.onFirst?.(),
      onPrev: () => editorShortcutsRef.current?.onPrev?.(),
      onNext: () => editorShortcutsRef.current?.onNext?.(),
      onLast: () => editorShortcutsRef.current?.onLast?.(),
      playbackEnabled: () => editorShortcutsRef.current?.playbackEnabled?.() ?? false,
      canPlay: () => editorShortcutsRef.current?.canPlay?.() ?? false,
    });

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
        ...shortcutKeymap,
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
    applyStepHighlight(view, highlightLineRef.current);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [applyStepHighlight, language, readOnly]);

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

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    applyStepHighlight(view, highlightLine);
  }, [applyStepHighlight, highlightLine]);

  return (
    <div
      ref={hostRef}
      className="h-full min-h-0 overflow-hidden rounded-lg border border-border/60"
    />
  );
}
