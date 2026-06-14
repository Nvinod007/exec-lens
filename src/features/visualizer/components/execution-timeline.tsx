"use client";

import {
  ChevronFirst,
  ChevronLast,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExecutionTimelineProps {
  currentIndex: number;
  totalSteps: number;
  isPlaying: boolean;
  playDisabled?: boolean;
  playDisabledReason?: string;
  onPlayToggle: () => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
}

/** Playback controls modeled after JS Visualizer 9000 step navigation. */
export function ExecutionTimeline({
  currentIndex,
  totalSteps,
  isPlaying,
  playDisabled = false,
  playDisabledReason,
  onPlayToggle,
  onFirst,
  onPrev,
  onNext,
  onLast,
}: ExecutionTimelineProps) {
  const progress = totalSteps > 1 ? (currentIndex / (totalSteps - 1)) * 100 : 0;
  const playBlocked = playDisabled && !isPlaying;

  const playButton = (
    <Button
      size="icon"
      onClick={onPlayToggle}
      disabled={playBlocked}
      aria-label={isPlaying ? "Pause" : "Play"}
      className="disabled:cursor-default"
    >
      {isPlaying ? <Pause /> : <Play />}
    </Button>
  );

  return (
    <div className="space-y-1.5 px-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <Button variant="outline" size="icon" onClick={onFirst} aria-label="First step">
            <ChevronFirst />
          </Button>
          <Button variant="outline" size="icon" onClick={onPrev} aria-label="Previous step">
            <SkipBack />
          </Button>
          {playBlocked && playDisabledReason ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">{playButton}</span>
              </TooltipTrigger>
              <TooltipContent className="bg-popover text-popover-foreground border-border max-w-[240px] border text-xs">
                {playDisabledReason}
              </TooltipContent>
            </Tooltip>
          ) : (
            playButton
          )}
          <Button variant="outline" size="icon" onClick={onNext} aria-label="Next step">
            <SkipForward />
          </Button>
          <Button variant="outline" size="icon" onClick={onLast} aria-label="Last step">
            <ChevronLast />
          </Button>
        </div>
        <p className="text-muted-foreground font-mono text-xs md:text-sm">
          Step {totalSteps === 0 ? 0 : currentIndex + 1} / {totalSteps}
        </p>
      </div>
      <div className="bg-muted/60 h-1 overflow-hidden rounded-full">
        <div
          className="bg-primary h-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
