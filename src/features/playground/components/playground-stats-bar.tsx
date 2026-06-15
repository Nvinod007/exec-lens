import { HintChip } from "@/components/shared/hint-label";
import {
  getTopFrameScopeCount,
  type CallStackFrame,
  type ExecutionStep,
} from "@/types/execution";

interface PlaygroundStatsBarProps {
  stackFrames: CallStackFrame[];
  currentStep?: ExecutionStep;
  breakpointCount: number;
  pausedAtBreakpoint?: boolean;
  currentStepIndex: number;
  totalSteps: number;
}

/** Header metrics — stack depth, breakpoints, timeline position. */
export function PlaygroundStatsBar({
  stackFrames,
  currentStep,
  breakpointCount,
  pausedAtBreakpoint = false,
  currentStepIndex,
  totalSteps,
}: PlaygroundStatsBarProps) {
  const variableCount = getTopFrameScopeCount(currentStep, stackFrames);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <HintChip label="Frames" tip="Function frames currently on the call stack.">
        {stackFrames.length} frames
      </HintChip>
      <HintChip label="Variables" tip="Tracked bindings in the top call-stack frame.">
        {variableCount} {variableCount === 1 ? "var" : "vars"}
      </HintChip>
      <HintChip label="Breakpoints" tip="Lines marked in the editor gutter.">
        {breakpointCount} bp
        {pausedAtBreakpoint ? (
          <span className="text-amber-600 dark:text-amber-400"> · paused</span>
        ) : null}
      </HintChip>
      <HintChip label="Step" tip="Current position in the execution timeline.">
        {totalSteps === 0 ? 0 : currentStepIndex + 1}/{totalSteps}
      </HintChip>
    </div>
  );
}
