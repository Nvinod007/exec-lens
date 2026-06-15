"use client";

import {
  ChevronFirst,
  ChevronLast,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { ActionTooltip } from "@/components/shared/action-tooltip";
import { Button } from "@/components/ui/button";
import { PLAYGROUND_SHORTCUTS } from "@/lib/keyboard/shortcuts";
import { cn } from "@/lib/utils";
import type { RunState } from "@/features/visualizer/hooks/use-playback";

interface ExecutionTimelineProps {
  currentIndex: number;
  totalSteps: number;
  runState: RunState;
  showRunResults: boolean;
  showPlaybackControls: boolean;
  isPlaying: boolean;
  pausedAtBreakpoint?: boolean;
  isStale: boolean;
  onRun: () => void;
  onReset: () => void;
  onPlayToggle: () => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}

/** Playback controls — run, step navigation, play/pause, and reset in one row. */
export function ExecutionTimeline({
  currentIndex,
  totalSteps,
  runState,
  showRunResults,
  showPlaybackControls,
  isPlaying,
  pausedAtBreakpoint = false,
  isStale,
  onRun,
  onReset,
  onPlayToggle,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: ExecutionTimelineProps) {
  const progress =
    showRunResults && totalSteps > 1 ? (currentIndex / (totalSteps - 1)) * 100 : 0;
  const isRunning = runState === "running";
  const canPlay = showPlaybackControls && !isRunning;
  const playLabel = isPlaying ? "Pause" : pausedAtBreakpoint ? "Continue" : "Play";
  const stepLabel = showRunResults
    ? `Step ${totalSteps === 0 ? 0 : currentIndex + 1} / ${totalSteps}`
    : null;

  const runButton = (
    <Button
      size="sm"
      onClick={onRun}
      disabled={isRunning}
      aria-label="Run"
      className="mr-1 gap-1.5"
    >
      <Play className="size-3.5 fill-current" />
      Run
    </Button>
  );

  const playPauseButton = (
    <Button
      variant="outline"
      size="icon"
      onClick={onPlayToggle}
      disabled={!canPlay}
      aria-label={playLabel}
    >
      {isPlaying ? <Pause /> : <Play className="fill-current" />}
    </Button>
  );

  return (
    <div className="space-y-1.5 px-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <ActionTooltip
            label="Run"
            shortcut={PLAYGROUND_SHORTCUTS.run}
            detail={isStale && !isRunning ? "Code changed — run to refresh" : undefined}
          >
            {runButton}
          </ActionTooltip>
          {showRunResults ? (
            <div
              className={cn(
                "flex items-center gap-0.5",
                !showPlaybackControls && "pointer-events-none invisible",
              )}
              aria-hidden={!showPlaybackControls}
            >
              <ActionTooltip label="First" shortcut={PLAYGROUND_SHORTCUTS.first}>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onFirst}
                  disabled={!showPlaybackControls}
                  aria-label="First step"
                >
                  <ChevronFirst />
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Previous" shortcut={PLAYGROUND_SHORTCUTS.prev}>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onPrev}
                  disabled={!showPlaybackControls}
                  aria-label="Previous step"
                >
                  <SkipBack />
                </Button>
              </ActionTooltip>
              {canPlay ? (
                <ActionTooltip label={playLabel} shortcut={PLAYGROUND_SHORTCUTS.playPause}>
                  {playPauseButton}
                </ActionTooltip>
              ) : (
                <Button variant="outline" size="icon" disabled aria-label={playLabel}>
                  {isPlaying ? <Pause /> : <Play className="fill-current" />}
                </Button>
              )}
              <ActionTooltip label="Next" shortcut={PLAYGROUND_SHORTCUTS.next}>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onNext}
                  disabled={!showPlaybackControls}
                  aria-label="Next step"
                >
                  <SkipForward />
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Last" shortcut={PLAYGROUND_SHORTCUTS.last}>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onLast}
                  disabled={!showPlaybackControls}
                  aria-label="Last step"
                >
                  <ChevronLast />
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Reset" shortcut={PLAYGROUND_SHORTCUTS.reset}>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onReset}
                  disabled={!showPlaybackControls}
                  aria-label="Reset to first step"
                >
                  <RotateCcw />
                </Button>
              </ActionTooltip>
            </div>
          ) : null}
        </div>
        {stepLabel ? (
          <p className="text-muted-foreground font-mono text-xs md:text-sm">{stepLabel}</p>
        ) : null}
      </div>
      {showRunResults ? (
        <div className="bg-muted/60 h-1 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
