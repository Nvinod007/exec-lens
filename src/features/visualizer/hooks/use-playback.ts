"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getStepEditorLine, type ExecutionStep, type RunResult } from "@/types/execution";

interface UsePlaybackOptions {
  steps: ExecutionStep[];
  autoPlay?: boolean;
  speedMs?: number;
  breakpoints?: number[];
}

function stepHitsBreakpoint(
  step: ExecutionStep | undefined,
  breakpointSet: ReadonlySet<number>,
): boolean {
  if (!step || breakpointSet.size === 0) return false;
  const line = getStepEditorLine(step);
  return line !== undefined && breakpointSet.has(line);
}

/** Controls timeline scrubbing and autoplay for execution steps. */
export function usePlayback({
  steps,
  autoPlay = false,
  speedMs = 900,
  breakpoints = [],
}: UsePlaybackOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  const breakpointSet = useMemo(() => new Set(breakpoints), [breakpoints]);
  const maxIndex = Math.max(steps.length - 1, 0);
  const currentStep = steps[currentIndex];

  const pauseOnBreakpoint = useCallback(
    (step: ExecutionStep | undefined) => {
      if (stepHitsBreakpoint(step, breakpointSet)) {
        setIsPlaying(false);
      }
    },
    [breakpointSet],
  );

  const goToStart = useCallback(() => setCurrentIndex(0), []);
  const goToEnd = useCallback(() => setCurrentIndex(maxIndex), [maxIndex]);
  const stepForward = useCallback(() => {
    setCurrentIndex((index) => {
      const next = Math.min(index + 1, maxIndex);
      pauseOnBreakpoint(steps[next]);
      return next;
    });
  }, [maxIndex, pauseOnBreakpoint, steps]);
  const stepBackward = useCallback(
    () => setCurrentIndex((index) => Math.max(index - 1, 0)),
    [],
  );

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!isPlaying || steps.length === 0) return;

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index >= maxIndex) {
          setIsPlaying(false);
          return index;
        }
        const next = index + 1;
        pauseOnBreakpoint(steps[next]);
        return next;
      });
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, maxIndex, pauseOnBreakpoint, speedMs, steps]);

  const pausedAtBreakpoint =
    breakpointSet.size > 0 &&
    !isPlaying &&
    stepHitsBreakpoint(currentStep, breakpointSet);

  return {
    currentIndex,
    currentStep,
    isPlaying,
    setIsPlaying,
    pausedAtBreakpoint,
    goToStart,
    goToEnd,
    stepForward,
    stepBackward,
    setCurrentIndex,
    totalSteps: steps.length,
  };
}

export type RunState = "idle" | "running" | "success" | "error";

/** Calls the run API and tracks loading / error state for the playground. */
export function useRunSnippet() {
  const [runState, setRunState] = useState<RunState>("idle");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<number | undefined>();
  const [teachingHint, setTeachingHint] = useState<string | undefined>();

  const run = useCallback(
    async (code: string, language: "javascript" | "typescript") => {
      setRunState("running");
      setError(null);
      setErrorLine(undefined);
      setTeachingHint(undefined);

      try {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, language }),
        });

        const data = (await response.json()) as RunResult & { error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Run failed.");
        }

        setResult(data);
        setRunState(data.error ? "error" : "success");
        if (data.error) {
          setError(data.error);
          setErrorLine(data.errorLine);
          setTeachingHint(data.teachingHint);
        }
      } catch (runError) {
        setRunState("error");
        setError(runError instanceof Error ? runError.message : "Run failed.");
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setRunState("idle");
    setResult(null);
    setError(null);
    setErrorLine(undefined);
    setTeachingHint(undefined);
  }, []);

  return { run, reset, runState, result, error, errorLine, teachingHint };
}
