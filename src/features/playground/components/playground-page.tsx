"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Aperture,
  LayoutPanelLeft,
  LayoutPanelTop,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";

import { HintChip } from "@/components/shared/hint-label";
import { ResizableSplit } from "@/components/shared/resizable-split";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CodeEditor } from "@/features/editor/components/code-editor";
import { getDefaultSnippet } from "@/features/examples/constants";
import { EXAMPLE_SNIPPETS } from "@/features/examples/data/example-snippets";
import { ConsoleDock } from "@/features/visualizer/components/console-dock";
import { RuntimeDashboard } from "@/features/visualizer/components/runtime-dashboard";
import { ExecutionTimeline } from "@/features/visualizer/components/execution-timeline";
import {
  usePlayback,
  useRunSnippet,
} from "@/features/visualizer/hooks/use-playback";
import { cn } from "@/lib/utils";

type EditorPlacement = "left" | "right" | "top";
type ConsolePosition = "top" | "bottom";

const EDITOR_MIN = 0.22;
const EDITOR_MAX = 0.55;
const EDITOR_TOP_MIN = 0.2;
const EDITOR_TOP_MAX = 0.5;
const CONSOLE_MIN = 0.16;
const CONSOLE_MAX = 0.4;
const CONSOLE_DEFAULT = 0.2;

function clampRatio(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Resizable playground — unified runtime dashboard + dockable console. */
export function PlaygroundPage() {
  const defaultSnippet = getDefaultSnippet();
  const [code, setCode] = useState(defaultSnippet.code);
  const [language, setLanguage] = useState<"javascript" | "typescript">(
    defaultSnippet.language,
  );
  const [selectedExample, setSelectedExample] = useState(defaultSnippet.id);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
  const [editorPlacement, setEditorPlacement] = useState<EditorPlacement>("left");
  const [editorRatio, setEditorRatio] = useState(0.42);
  const [consolePosition, setConsolePosition] = useState<ConsolePosition>("bottom");
  const [consoleRatio, setConsoleRatio] = useState(CONSOLE_DEFAULT);
  const [committedCode, setCommittedCode] = useState<string | null>(null);
  const [committedLanguage, setCommittedLanguage] = useState<
    "javascript" | "typescript" | null
  >(null);
  const pendingRunRef = useRef<{
    code: string;
    language: "javascript" | "typescript";
  } | null>(null);

  const { run, runState, result, error, errorLine } = useRunSnippet();
  const steps = result?.steps ?? [];

  const playback = usePlayback({ steps, speedMs: 850 });
  const currentStep = playback.currentStep;
  const stackFrames = currentStep?.callStack ?? [];
  const consoleEntries = currentStep?.console ?? [];

  const isStale =
    committedCode !== null &&
    (code !== committedCode || language !== committedLanguage);

  useEffect(() => {
    if (runState === "success" && result?.steps?.length && pendingRunRef.current) {
      setCommittedCode(pendingRunRef.current.code);
      setCommittedLanguage(pendingRunRef.current.language);
      pendingRunRef.current = null;
    }
  }, [runState, result]);

  useEffect(() => {
    if (isStale && playback.isPlaying) {
      playback.setIsPlaying(false);
    }
  }, [isStale, playback.isPlaying, playback.setIsPlaying]);

  const handleRun = () => {
    pendingRunRef.current = { code, language };
    playback.setIsPlaying(false);
    run(code, language);
  };

  const handleToggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) =>
      prev.includes(line) ? prev.filter((l) => l !== line) : [...prev, line].sort((a, b) => a - b),
    );
  }, []);

  const handleExampleChange = (exampleId: string) => {
    const example = EXAMPLE_SNIPPETS.find((item) => item.id === exampleId);
    if (!example) return;
    setSelectedExample(example.id);
    setCode(example.code);
    setLanguage(example.language);
    setCommittedCode(null);
    setCommittedLanguage(null);
    playback.setIsPlaying(false);
  };

  const handleReset = () => {
    playback.goToStart();
    playback.setIsPlaying(false);
  };

  const editorMin = editorPlacement === "top" ? EDITOR_TOP_MIN : EDITOR_MIN;
  const editorMax = editorPlacement === "top" ? EDITOR_TOP_MAX : EDITOR_MAX;

  const setEditorPlacementSafe = (placement: EditorPlacement) => {
    const min = placement === "top" ? EDITOR_TOP_MIN : EDITOR_MIN;
    const max = placement === "top" ? EDITOR_TOP_MAX : EDITOR_MAX;
    setEditorPlacement(placement);
    setEditorRatio((r) => clampRatio(r, min, max));
  };

  const setConsoleRatioSafe = (ratio: number) => {
    setConsoleRatio(clampRatio(ratio, CONSOLE_MIN, CONSOLE_MAX));
  };

  const editorPane = (
    <section className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="text-muted-foreground flex shrink-0 items-center justify-between px-3 py-2 text-sm">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help border-b border-dotted border-muted-foreground/35 font-semibold tracking-widest uppercase">
              Snippet
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border-border max-w-[220px] border text-xs">
            Your JavaScript or TypeScript code. Syntax errors show inline; click line numbers for breakpoints.
          </TooltipContent>
        </Tooltip>
        {errorLine ? (
          <span className="text-destructive font-mono normal-case">line {errorLine}</span>
        ) : isStale ? (
          <span className="text-amber-500/90 font-mono text-xs normal-case">
            edited — run to refresh
          </span>
        ) : currentStep?.activeLine ? (
          <span className="text-primary font-mono normal-case">
            ● line {currentStep.activeLine}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 px-2 pb-2">
        <CodeEditor
          value={code}
          onChange={setCode}
          language={language}
          activeLine={errorLine ? undefined : currentStep?.activeLine}
          errorLine={errorLine}
          breakpoints={breakpoints}
          onToggleBreakpoint={handleToggleBreakpoint}
        />
      </div>
    </section>
  );

  const runtimePane = (
    <section className="flex h-full min-h-0 flex-col overflow-hidden p-2">
      <RuntimeDashboard
        step={currentStep}
        frames={stackFrames}
        breakpoints={breakpoints}
        isRunning={playback.isPlaying || runState === "running"}
      />
    </section>
  );

  const workspace =
    editorPlacement === "right" ? (
      <ResizableSplit
          direction="horizontal"
          ratio={1 - editorRatio}
          minRatio={1 - editorMax}
          maxRatio={1 - editorMin}
          onRatioChange={(r) => setEditorRatio(clampRatio(1 - r, editorMin, editorMax))}
          first={runtimePane}
          second={editorPane}
          className="h-full min-h-0"
        />
      ) : (
        <ResizableSplit
          direction={editorPlacement === "top" ? "vertical" : "horizontal"}
          ratio={editorRatio}
          minRatio={editorMin}
          maxRatio={editorMax}
          onRatioChange={(r) => setEditorRatio(clampRatio(r, editorMin, editorMax))}
          first={editorPane}
          second={runtimePane}
          className="h-full min-h-0"
        />
    );

  const consolePane = (
    <ConsoleDock
      entries={consoleEntries}
      position={consolePosition}
      onReposition={setConsolePosition}
    />
  );

  const body =
    consolePosition === "top" ? (
      <ResizableSplit
        direction="vertical"
        ratio={consoleRatio}
        minRatio={CONSOLE_MIN}
        maxRatio={CONSOLE_MAX}
        onRatioChange={setConsoleRatioSafe}
        onHandleDoubleClick={() => setConsolePosition("bottom")}
        first={consolePane}
        second={workspace}
        className="h-full min-h-0 flex-1"
      />
    ) : (
      <ResizableSplit
        direction="vertical"
        ratio={1 - consoleRatio}
        minRatio={1 - CONSOLE_MAX}
        maxRatio={1 - CONSOLE_MIN}
        onRatioChange={(r) => setConsoleRatioSafe(1 - r)}
        onHandleDoubleClick={() => setConsolePosition("top")}
        first={workspace}
        second={consolePane}
        className="h-full min-h-0 flex-1"
      />
    );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-border/50 px-3 py-2 md:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-primary/15 text-primary flex size-8 items-center justify-center rounded-full">
                <Aperture className="size-4" />
              </div>
              <div>
                <h1 className="text-lg font-bold">ExecLens</h1>
                <p className="text-muted-foreground text-xs">See JavaScript execute</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <HintChip label="Frames" tip="Function frames currently on the call stack.">
                {stackFrames.length} frames
              </HintChip>
              <HintChip label="Variables" tip="Tracked scope variables — Phase 3.">
                0 vars
              </HintChip>
              <HintChip label="Breakpoints" tip="Lines marked in the editor gutter.">
                {breakpoints.length} bp
              </HintChip>
              <HintChip label="Step" tip="Current position in the execution timeline.">
                {playback.totalSteps === 0 ? 0 : playback.currentIndex + 1}/
                {playback.totalSteps}
              </HintChip>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-muted/40 flex rounded-lg p-0.5">
                {(
                  [
                    { id: "left" as const, icon: LayoutPanelLeft, tip: "Editor on the left", flip: false },
                    { id: "top" as const, icon: LayoutPanelTop, tip: "Editor on top", flip: false },
                    { id: "right" as const, icon: LayoutPanelLeft, tip: "Editor on the right", flip: true },
                  ] as const
                ).map(({ id, icon: Icon, tip, flip }) => (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setEditorPlacementSafe(id)}
                        className={cn(
                          "rounded-md p-1.5 transition-colors",
                          editorPlacement === id
                            ? "bg-background text-primary shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        aria-label={tip}
                      >
                        <Icon className={cn("size-3.5", flip && "scale-x-[-1]")} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover text-popover-foreground border-border border text-xs">
                      {tip}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <Select value={selectedExample} onValueChange={handleExampleChange}>
                <SelectTrigger className="h-9 w-[170px] text-sm">
                  <SelectValue placeholder="Example" />
                </SelectTrigger>
                <SelectContent>
                  {EXAMPLE_SNIPPETS.map((example) => (
                    <SelectItem key={example.id} value={example.id}>
                      {example.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={language}
                onValueChange={(value: "javascript" | "typescript") =>
                  setLanguage(value)
                }
              >
                <SelectTrigger className="h-9 w-[110px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JS</SelectItem>
                  <SelectItem value="typescript">TS</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleRun} disabled={runState === "running"} size="sm">
                <Play className="size-3.5 fill-current" />
                Run
              </Button>
              <Button variant="outline" size="sm" onClick={() => playback.setIsPlaying(false)} disabled={!steps.length}>
                <Square className="size-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-2">
            <ExecutionTimeline
              currentIndex={playback.currentIndex}
              totalSteps={playback.totalSteps}
              isPlaying={playback.isPlaying}
              playDisabled={isStale}
              playDisabledReason="Code changed — click Run to rebuild the timeline before playing."
              onPlayToggle={() => playback.setIsPlaying((v) => !v)}
              onFirst={playback.goToStart}
              onPrev={playback.stepBackward}
              onNext={playback.stepForward}
              onLast={playback.goToEnd}
            />
          </div>

          {error ? <p className="text-destructive mt-1 text-sm">{error}</p> : null}
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</main>
      </div>
    </TooltipProvider>
  );
}
