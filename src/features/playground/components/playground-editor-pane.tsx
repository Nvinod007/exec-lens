import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CodeEditor } from "@/features/editor/components/code-editor";
import type { EditorShortcutHandlers } from "@/features/editor/lib/editor-shortcut-keymap";

interface PlaygroundEditorPaneProps {
  code: string;
  language: "javascript" | "typescript";
  errorLine?: number;
  isStale: boolean;
  activeLine?: number;
  breakpoints: number[];
  editorShortcuts?: EditorShortcutHandlers;
  onChange: (code: string) => void;
  onToggleBreakpoint: (line: number) => void;
}

/** Snippet editor with status line — errors, stale edits, or active execution line. */
export function PlaygroundEditorPane({
  code,
  language,
  errorLine,
  isStale,
  activeLine,
  breakpoints,
  editorShortcuts,
  onChange,
  onToggleBreakpoint,
}: PlaygroundEditorPaneProps) {
  return (
    <section className="bg-muted/25 flex h-full min-h-0 flex-col overflow-hidden">
      <div className="text-muted-foreground flex shrink-0 items-center justify-between px-3 py-2 text-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help border-b border-dotted border-muted-foreground/35 font-semibold tracking-widest uppercase">
              Snippet
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border-border max-w-[220px] border text-xs">
            Your JavaScript or TypeScript code. While editing, use F7/F8/F9 to step playback.
            Syntax errors show inline; click line numbers for breakpoints.
          </TooltipContent>
        </Tooltip>
        {errorLine ? (
          <span className="text-destructive font-mono normal-case">line {errorLine}</span>
        ) : isStale ? (
          <span className="text-amber-500/90 font-mono text-xs normal-case">
            edited — run to refresh
          </span>
        ) : activeLine ? (
          <span className="text-primary font-mono normal-case">● line {activeLine}</span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 px-2 pb-2">
        <CodeEditor
          value={code}
          onChange={onChange}
          language={language}
          activeLine={errorLine ? undefined : activeLine}
          errorLine={errorLine}
          breakpoints={breakpoints}
          onToggleBreakpoint={onToggleBreakpoint}
          editorShortcuts={editorShortcuts}
        />
      </div>
    </section>
  );
}
