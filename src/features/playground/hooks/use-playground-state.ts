"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getDefaultSnippet, CUSTOM_SNIPPET_ID } from "@/features/examples/constants";
import { EXAMPLE_SNIPPETS } from "@/features/examples/data/example-snippets";
import {
  usePlayback,
  useRunSnippet,
} from "@/features/visualizer/hooks/use-playback";

import { playgroundDebug } from "@/features/playground/lib/playground-debug";

import {
  CONSOLE_DEFAULT,
  CONSOLE_MAX,
  CONSOLE_MIN,
  clampRatio,
  editorBounds,
  type ConsolePosition,
  type EditorPlacement,
} from "@/features/playground/lib/layout-constants";

/** Playground editor/run/playback state — keeps the page component declarative. */
export function usePlaygroundState() {
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

  const { run, reset: resetRun, runState, result, error, errorLine } = useRunSnippet();
  const steps = result?.steps ?? [];

  const playback = usePlayback({ steps, speedMs: 850 });
  const currentStep = playback.currentStep;
  const stackFrames = currentStep?.callStack ?? [];
  const consoleEntries = currentStep?.console ?? [];

  const isStale =
    committedCode !== null &&
    (code !== committedCode || language !== committedLanguage);

  const showPlayback =
    committedCode !== null &&
    !isStale &&
    runState !== "idle" &&
    runState !== "running" &&
    steps.length > 0;

  const activeStep = showPlayback ? currentStep : undefined;
  const activeStackFrames = showPlayback ? stackFrames : [];
  const activeConsoleEntries = showPlayback ? consoleEntries : [];

  useEffect(() => {
    if (
      (runState === "success" || runState === "error") &&
      result?.steps?.length &&
      pendingRunRef.current
    ) {
      setCommittedCode(pendingRunRef.current.code);
      setCommittedLanguage(pendingRunRef.current.language);
      pendingRunRef.current = null;
    }
  }, [runState, result]);

  useEffect(() => {
    if (result?.error && steps.length > 0) {
      playback.goToEnd();
    }
  }, [result?.error, steps.length, playback.goToEnd]);

  useEffect(() => {
    if (isStale) {
      playback.goToStart();
      playback.setIsPlaying(false);
    }
  }, [isStale, playback.goToStart, playback.setIsPlaying]);

  const handleRun = () => {
    pendingRunRef.current = { code, language };
    playback.setIsPlaying(false);
    run(code, language);
  };

  const handleToggleBreakpoint = useCallback((line: number) => {
    setBreakpoints((prev) =>
      prev.includes(line)
        ? prev.filter((l) => l !== line)
        : [...prev, line].sort((a, b) => a - b),
    );
  }, []);

  const handleExampleChange = (exampleId: string) => {
    const example = EXAMPLE_SNIPPETS.find((item) => item.id === exampleId);
    if (!example) return;
    pendingRunRef.current = null;
    resetRun();
    playback.goToStart();
    playback.setIsPlaying(false);
    setSelectedExample(example.id);
    setCode(example.code);
    setLanguage(example.language);
    setCommittedCode(null);
    setCommittedLanguage(null);
    playgroundDebug.log("example selected", {
      exampleId: example.id,
      language: example.language,
    });
  };

  const handleLanguageChange = (nextLanguage: "javascript" | "typescript") => {
    const example = EXAMPLE_SNIPPETS.find((item) => item.id === selectedExample);
    if (example && example.language !== nextLanguage) {
      setSelectedExample(CUSTOM_SNIPPET_ID);
      playgroundDebug.log("language desynced from example", {
        selectedExample: example.id,
        exampleLanguage: example.language,
        nextLanguage,
      });
    } else {
      playgroundDebug.log("language changed", {
        selectedExample,
        nextLanguage,
      });
    }
    setLanguage(nextLanguage);
  };

  const handleCodeChange = useCallback(
    (nextCode: string) => {
      setCode(nextCode);
      if (selectedExample === CUSTOM_SNIPPET_ID) return;

      const example = EXAMPLE_SNIPPETS.find((item) => item.id === selectedExample);
      if (!example || example.code !== nextCode) {
        setSelectedExample(CUSTOM_SNIPPET_ID);
        playgroundDebug.log("code desynced from example", { selectedExample });
      }
    },
    [selectedExample],
  );

  const handleReset = () => {
    playback.goToStart();
    playback.setIsPlaying(false);
  };

  const { min: editorMin, max: editorMax } = editorBounds(editorPlacement);

  const setEditorPlacementSafe = (placement: EditorPlacement) => {
    const { min, max } = editorBounds(placement);
    setEditorPlacement(placement);
    setEditorRatio((r) => clampRatio(r, min, max));
  };

  const setEditorRatioSafe = (ratio: number) => {
    setEditorRatio(clampRatio(ratio, editorMin, editorMax));
  };

  const setConsoleRatioSafe = (ratio: number) => {
    setConsoleRatio(clampRatio(ratio, CONSOLE_MIN, CONSOLE_MAX));
  };

  return {
    code,
    setCode: handleCodeChange,
    language,
    setLanguage,
    selectedExample,
    breakpoints,
    editorPlacement,
    editorRatio,
    consolePosition,
    setConsolePosition,
    consoleRatio,
    runState,
    error,
    errorLine,
    steps,
    playback,
    currentStep: activeStep,
    stackFrames: activeStackFrames,
    consoleEntries: activeConsoleEntries,
    isStale,
    showPlayback,
    editorMin,
    editorMax,
    handleRun,
    handleToggleBreakpoint,
    handleExampleChange,
    handleLanguageChange,
    handleReset,
    setEditorPlacementSafe,
    setEditorRatioSafe,
    setConsoleRatioSafe,
  };
}
