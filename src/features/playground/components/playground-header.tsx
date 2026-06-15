import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ExecLensLogo } from "@/components/shared/exec-lens-logo";
import { EditorPlacementToggle } from "@/features/playground/components/editor-placement-toggle";
import { PlaygroundStatsBar } from "@/features/playground/components/playground-stats-bar";
import { PlaygroundToolbar } from "@/features/playground/components/playground-toolbar";
import type { EditorPlacement } from "@/features/playground/lib/layout-constants";
import { ExecutionTimeline } from "@/features/visualizer/components/execution-timeline";
import type { RunState } from "@/features/visualizer/hooks/use-playback";
import type { CallStackFrame, ExecutionStep } from "@/types/execution";

interface PlaygroundHeaderProps {
  stackFrames: CallStackFrame[];
  currentStep?: ExecutionStep;
  breakpointCount: number;
  pausedAtBreakpoint?: boolean;
  currentStepIndex: number;
  totalSteps: number;
  editorPlacement: EditorPlacement;
  selectedExample: string;
  language: "javascript" | "typescript";
  runState: RunState;
  showRunResults: boolean;
  showPlaybackControls: boolean;
  isPlaying: boolean;
  isStale: boolean;
  error?: string;
  errorLine?: number;
  teachingHint?: string;
  onEditorPlacementChange: (placement: EditorPlacement) => void;
  onExampleChange: (exampleId: string) => void;
  onLanguageChange: (language: "javascript" | "typescript") => void;
  onRun: () => void;
  onReset: () => void;
  onPlayToggle: () => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}

/** Top bar — branding, stats, layout controls, run toolbar, and timeline. */
export function PlaygroundHeader({
  stackFrames,
  currentStep,
  breakpointCount,
  pausedAtBreakpoint,
  currentStepIndex,
  totalSteps,
  editorPlacement,
  selectedExample,
  language,
  runState,
  showRunResults,
  showPlaybackControls,
  isPlaying,
  isStale,
  error,
  errorLine,
  teachingHint,
  onEditorPlacementChange,
  onExampleChange,
  onLanguageChange,
  onRun,
  onReset,
  onPlayToggle,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: PlaygroundHeaderProps) {
  return (
    <header className="bg-card/90 shrink-0 border-b border-border/60 px-3 py-2 md:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-primary/15 text-primary flex size-8 items-center justify-center rounded-full p-1.5">
            <ExecLensLogo variant="aperture" />
          </div>
          <div>
            <h1 className="text-lg font-bold">ExecLens</h1>
            <p className="text-muted-foreground text-xs">See JavaScript execute</p>
          </div>
        </div>

        <PlaygroundStatsBar
          stackFrames={stackFrames}
          currentStep={currentStep}
          breakpointCount={breakpointCount}
          pausedAtBreakpoint={pausedAtBreakpoint}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
        />

        <div className="flex flex-wrap items-center gap-2">
          <EditorPlacementToggle value={editorPlacement} onChange={onEditorPlacementChange} />
          <PlaygroundToolbar
            selectedExample={selectedExample}
            language={language}
            onExampleChange={onExampleChange}
            onLanguageChange={onLanguageChange}
          />
          <ThemeToggle />
        </div>
      </div>

      <div className="mt-2">
        <ExecutionTimeline
          currentIndex={currentStepIndex}
          totalSteps={totalSteps}
          runState={runState}
          showRunResults={showRunResults}
          showPlaybackControls={showPlaybackControls}
          isPlaying={isPlaying}
          pausedAtBreakpoint={pausedAtBreakpoint}
          isStale={isStale}
          onRun={onRun}
          onReset={onReset}
          onPlayToggle={onPlayToggle}
          onFirst={onFirst}
          onPrev={onPrev}
          onNext={onNext}
          onLast={onLast}
        />
      </div>

      {error ? (
        <div className="text-destructive mt-1 space-y-0.5 text-sm">
          <p>{errorLine ? `Line ${errorLine}: ${error}` : error}</p>
          {teachingHint ? (
            <p className="text-muted-foreground text-xs">{teachingHint}</p>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
