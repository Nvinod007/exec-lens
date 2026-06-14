import { ResizableSplit } from "@/components/shared/resizable-split";
import { PlaygroundEditorPane } from "@/features/playground/components/playground-editor-pane";
import {
  clampRatio,
  type EditorPlacement,
} from "@/features/playground/lib/layout-constants";
import { RuntimeDashboard } from "@/features/visualizer/components/runtime-dashboard";
import type { EditorShortcutHandlers } from "@/features/editor/lib/editor-shortcut-keymap";
import {
  getStepEditorLine,
  type CallStackFrame,
  type ExecutionStep,
} from "@/types/execution";

interface PlaygroundWorkspaceProps {
  editorPlacement: EditorPlacement;
  editorRatio: number;
  editorMin: number;
  editorMax: number;
  code: string;
  language: "javascript" | "typescript";
  errorLine?: number;
  isStale: boolean;
  currentStep?: ExecutionStep;
  breakpoints: number[];
  stackFrames: CallStackFrame[];
  isRunning: boolean;
  editorShortcuts?: EditorShortcutHandlers;
  onCodeChange: (code: string) => void;
  onToggleBreakpoint: (line: number) => void;
  onEditorRatioChange: (ratio: number) => void;
  currentStepPanelCollapsed: boolean;
  onCurrentStepPanelCollapsedChange: (collapsed: boolean) => void;
}

/** Resizable editor + runtime dashboard — placement-aware split direction. */
export function PlaygroundWorkspace({
  editorPlacement,
  editorRatio,
  editorMin,
  editorMax,
  code,
  language,
  errorLine,
  isStale,
  currentStep,
  breakpoints,
  stackFrames,
  isRunning,
  editorShortcuts,
  onCodeChange,
  onToggleBreakpoint,
  onEditorRatioChange,
  currentStepPanelCollapsed,
  onCurrentStepPanelCollapsedChange,
}: PlaygroundWorkspaceProps) {
  const editorPane = (
    <PlaygroundEditorPane
      code={code}
      language={language}
      errorLine={errorLine}
      isStale={isStale}
      activeLine={getStepEditorLine(currentStep)}
      breakpoints={breakpoints}
      onChange={onCodeChange}
      onToggleBreakpoint={onToggleBreakpoint}
      editorShortcuts={editorShortcuts}
    />
  );

  const runtimePane = (
    <section className="bg-muted/20 flex h-full min-h-0 flex-col overflow-hidden p-2">
      <RuntimeDashboard
        step={currentStep}
        frames={stackFrames}
        isRunning={isRunning}
        currentStepPanelCollapsed={currentStepPanelCollapsed}
        onCurrentStepPanelCollapsedChange={onCurrentStepPanelCollapsedChange}
      />
    </section>
  );

  if (editorPlacement === "right") {
    return (
      <ResizableSplit
        direction="horizontal"
        ratio={1 - editorRatio}
        minRatio={1 - editorMax}
        maxRatio={1 - editorMin}
        onRatioChange={(r) =>
          onEditorRatioChange(clampRatio(1 - r, editorMin, editorMax))
        }
        first={runtimePane}
        second={editorPane}
        className="h-full min-h-0"
      />
    );
  }

  return (
    <ResizableSplit
      direction={editorPlacement === "top" ? "vertical" : "horizontal"}
      ratio={editorRatio}
      minRatio={editorMin}
      maxRatio={editorMax}
      onRatioChange={(r) => onEditorRatioChange(clampRatio(r, editorMin, editorMax))}
      first={editorPane}
      second={runtimePane}
      className="h-full min-h-0"
    />
  );
}
