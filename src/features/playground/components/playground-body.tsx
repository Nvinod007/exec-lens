import { ResizableSplit } from "@/components/shared/resizable-split";
import { PlaygroundWorkspace } from "@/features/playground/components/playground-workspace";
import {
  CONSOLE_MAX,
  CONSOLE_MIN,
  type ConsolePosition,
  type EditorPlacement,
} from "@/features/playground/lib/layout-constants";
import { ConsoleDock } from "@/features/visualizer/components/console-dock";
import type { EditorShortcutHandlers } from "@/features/editor/lib/editor-shortcut-keymap";
import type { CallStackFrame, ConsoleEntry, ExecutionStep } from "@/types/execution";

interface PlaygroundBodyProps {
  consolePosition: ConsolePosition;
  consoleRatio: number;
  consoleEntries: ConsoleEntry[];
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
  onConsolePositionChange: (position: ConsolePosition) => void;
  onConsoleRatioChange: (ratio: number) => void;
}

/** Main content — dockable console above or below the editor/runtime workspace. */
export function PlaygroundBody({
  consolePosition,
  consoleRatio,
  consoleEntries,
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
  onConsolePositionChange,
  onConsoleRatioChange,
}: PlaygroundBodyProps) {
  const workspace = (
    <PlaygroundWorkspace
      editorPlacement={editorPlacement}
      editorRatio={editorRatio}
      editorMin={editorMin}
      editorMax={editorMax}
      code={code}
      language={language}
      errorLine={errorLine}
      isStale={isStale}
      currentStep={currentStep}
      breakpoints={breakpoints}
      stackFrames={stackFrames}
      isRunning={isRunning}
      editorShortcuts={editorShortcuts}
      onCodeChange={onCodeChange}
      onToggleBreakpoint={onToggleBreakpoint}
      onEditorRatioChange={onEditorRatioChange}
    />
  );

  const consolePane = (
    <ConsoleDock
      entries={consoleEntries}
      position={consolePosition}
      onReposition={onConsolePositionChange}
    />
  );

  if (consolePosition === "top") {
    return (
      <ResizableSplit
        direction="vertical"
        ratio={consoleRatio}
        minRatio={CONSOLE_MIN}
        maxRatio={CONSOLE_MAX}
        onRatioChange={onConsoleRatioChange}
        onHandleDoubleClick={() => onConsolePositionChange("bottom")}
        first={consolePane}
        second={workspace}
        className="h-full min-h-0 flex-1"
      />
    );
  }

  return (
    <ResizableSplit
      direction="vertical"
      ratio={1 - consoleRatio}
      minRatio={1 - CONSOLE_MAX}
      maxRatio={1 - CONSOLE_MIN}
      onRatioChange={(r) => onConsoleRatioChange(1 - r)}
      onHandleDoubleClick={() => onConsolePositionChange("top")}
      first={workspace}
      second={consolePane}
      className="h-full min-h-0 flex-1"
    />
  );
}
