import { HintChip } from "@/components/shared/hint-label";
import type { CallStackFrame } from "@/types/execution";

interface PlaygroundStatsBarProps {
  stackFrames: CallStackFrame[];
  breakpointCount: number;
  currentStepIndex: number;
  totalSteps: number;
}

/** Header metrics — stack depth, breakpoints, timeline position. */
export function PlaygroundStatsBar({
  stackFrames,
  breakpointCount,
  currentStepIndex,
  totalSteps,
}: PlaygroundStatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <HintChip label="Frames" tip="Function frames currently on the call stack.">
        {stackFrames.length} frames
      </HintChip>
      <HintChip label="Variables" tip="Tracked scope variables — Phase 3.">
        0 vars
      </HintChip>
      <HintChip label="Breakpoints" tip="Lines marked in the editor gutter.">
        {breakpointCount} bp
      </HintChip>
      <HintChip label="Step" tip="Current position in the execution timeline.">
        {totalSteps === 0 ? 0 : currentStepIndex + 1}/{totalSteps}
      </HintChip>
    </div>
  );
}
