"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExecutionStep, RunResult } from "@/types/execution";

interface UsePlaybackOptions {
  steps: ExecutionStep[];
  autoPlay?: boolean;
  speedMs?: number;
}

/** Controls timeline scrubbing and autoplay for execution steps. */
export function usePlayback({ steps, autoPlay = false, speedMs = 900 }: UsePlaybackOptions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);

  const maxIndex = Math.max(steps.length - 1, 0);
  const currentStep = steps[currentIndex];

  const goToStart = useCallback(() => setCurrentIndex(0), []);
  const goToEnd = useCallback(() => setCurrentIndex(maxIndex), [maxIndex]);
  const stepForward = useCallback(
    () => setCurrentIndex((index) => Math.min(index + 1, maxIndex)),
    [maxIndex],
  );
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
        return index + 1;
      });
    }, speedMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, maxIndex, speedMs, steps.length]);

  return {
    currentIndex,
    currentStep,
    isPlaying,
    setIsPlaying,
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

  const run = useCallback(
    async (code: string, language: "javascript" | "typescript") => {
      setRunState("running");
      setError(null);
      setErrorLine(undefined);

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
  }, []);

  return { run, reset, runState, result, error, errorLine };
}
