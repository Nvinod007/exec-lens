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
  buildCustomDraft,
  loadPreferences,
  loadSession,
  savePreferences,
  saveSession,
  type PlaygroundPreferences,
} from "@/features/playground/lib/playground-storage";

import {
  CONSOLE_DEFAULT,
  CONSOLE_MAX,
  CONSOLE_MIN,
  clampRatio,
  editorBounds,
  type ConsolePosition,
  type EditorPlacement,
} from "@/features/playground/lib/layout-constants";

const CODE_AUTOSAVE_MS = 500;
const LAYOUT_RATIO_DEBOUNCE_MS = 300;

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
  const [currentStepPanelCollapsed, setCurrentStepPanelCollapsed] = useState(false);
  const [committedCode, setCommittedCode] = useState<string | null>(null);
  const [committedLanguage, setCommittedLanguage] = useState<
    "javascript" | "typescript" | null
  >(null);
  const hydratedRef = useRef(false);
  const layoutSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRunRef = useRef<{
    code: string;
    language: "javascript" | "typescript";
  } | null>(null);

  const persistPreferences = useCallback(
    (
      immediate = false,
      overrides?: Partial<
        Pick<
          PlaygroundPreferences,
          | "editorPlacement"
          | "consolePosition"
          | "editorRatio"
          | "consoleRatio"
          | "currentStepPanelCollapsed"
        >
      >,
    ) => {
      if (!hydratedRef.current) return;

      const write = () => {
        savePreferences({
          editorPlacement: overrides?.editorPlacement ?? editorPlacement,
          consolePosition: overrides?.consolePosition ?? consolePosition,
          editorRatio: overrides?.editorRatio ?? editorRatio,
          consoleRatio: overrides?.consoleRatio ?? consoleRatio,
          currentStepPanelCollapsed:
            overrides?.currentStepPanelCollapsed ?? currentStepPanelCollapsed,
        });
      };

      if (immediate) {
        if (layoutSaveTimerRef.current) {
          clearTimeout(layoutSaveTimerRef.current);
          layoutSaveTimerRef.current = null;
        }
        write();
        return;
      }

      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
      layoutSaveTimerRef.current = setTimeout(() => {
        layoutSaveTimerRef.current = null;
        write();
      }, LAYOUT_RATIO_DEBOUNCE_MS);
    },
    [consolePosition, consoleRatio, currentStepPanelCollapsed, editorPlacement, editorRatio],
  );

  const persistSession = useCallback(
    (
      nextSelectedExample: string,
      nextLanguage: "javascript" | "typescript",
      nextCode: string,
      immediate = false,
    ) => {
      if (!hydratedRef.current) return;

      const write = () => {
        if (nextSelectedExample === CUSTOM_SNIPPET_ID) {
          const customDraft = buildCustomDraft(nextCode, nextLanguage);
          if (!customDraft) return;
          saveSession({
            selectedExample: CUSTOM_SNIPPET_ID,
            language: nextLanguage,
            customDraft,
          });
          return;
        }

        saveSession({
          selectedExample: nextSelectedExample,
          language: nextLanguage,
        });
      };

      if (immediate) {
        if (sessionSaveTimerRef.current) {
          clearTimeout(sessionSaveTimerRef.current);
          sessionSaveTimerRef.current = null;
        }
        write();
        return;
      }

      if (sessionSaveTimerRef.current) clearTimeout(sessionSaveTimerRef.current);
      sessionSaveTimerRef.current = setTimeout(() => {
        sessionSaveTimerRef.current = null;
        write();
      }, CODE_AUTOSAVE_MS);
    },
    [],
  );

  useEffect(() => {
    const prefs = loadPreferences();
    const { min: editorMinBound, max: editorMaxBound } = editorBounds(
      prefs.editorPlacement,
    );

    setEditorPlacement(prefs.editorPlacement);
    setEditorRatio(clampRatio(prefs.editorRatio, editorMinBound, editorMaxBound));
    setConsolePosition(prefs.consolePosition);
    setConsoleRatio(clampRatio(prefs.consoleRatio, CONSOLE_MIN, CONSOLE_MAX));
    setCurrentStepPanelCollapsed(prefs.currentStepPanelCollapsed);

    const session = loadSession();
    if (session) {
      if (session.selectedExample === CUSTOM_SNIPPET_ID && session.customDraft) {
        setSelectedExample(CUSTOM_SNIPPET_ID);
        setCode(session.customDraft.code);
        setLanguage(session.customDraft.language);
        playgroundDebug.log("session restored", { kind: "custom" });
      } else {
        const example = EXAMPLE_SNIPPETS.find(
          (item) => item.id === session.selectedExample,
        );
        if (example) {
          setSelectedExample(example.id);
          setCode(example.code);
          setLanguage(example.language);
          playgroundDebug.log("session restored", { kind: "example", id: example.id });
        } else {
          playgroundDebug.log("session example missing from catalog", {
            selectedExample: session.selectedExample,
          });
        }
      }
    }

    hydratedRef.current = true;

    return () => {
      if (layoutSaveTimerRef.current) clearTimeout(layoutSaveTimerRef.current);
      if (sessionSaveTimerRef.current) clearTimeout(sessionSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    persistPreferences();
  }, [consoleRatio, editorRatio, persistPreferences]);

  const { run, reset: resetRun, runState, result, error, errorLine, teachingHint } =
    useRunSnippet();
  const steps = result?.steps ?? [];

  const playback = usePlayback({ steps, speedMs: 850 });
  const currentStep = playback.currentStep;
  const stackFrames = currentStep?.callStack ?? [];
  const consoleEntries = currentStep?.console ?? [];

  const isStale =
    committedCode !== null &&
    (code !== committedCode || language !== committedLanguage);

  const showRunResults =
    committedCode !== null &&
    !isStale &&
    runState !== "idle" &&
    steps.length > 0;

  const showPlaybackControls = showRunResults && runState !== "running";

  const activeStep = showRunResults ? currentStep : undefined;
  const activeStackFrames = showRunResults ? stackFrames : [];
  const activeConsoleEntries = showRunResults ? consoleEntries : [];

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
    persistSession(example.id, example.language, example.code, true);
    playgroundDebug.log("example selected", {
      exampleId: example.id,
      language: example.language,
    });
  };

  const handleLanguageChange = (nextLanguage: "javascript" | "typescript") => {
    const example = EXAMPLE_SNIPPETS.find((item) => item.id === selectedExample);
    let nextSelectedExample = selectedExample;

    if (example && example.language !== nextLanguage) {
      nextSelectedExample = CUSTOM_SNIPPET_ID;
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
    persistSession(nextSelectedExample, nextLanguage, code, true);
  };

  const handleCodeChange = useCallback(
    (nextCode: string) => {
      setCode(nextCode);

      let nextSelectedExample = selectedExample;
      if (selectedExample !== CUSTOM_SNIPPET_ID) {
        const example = EXAMPLE_SNIPPETS.find((item) => item.id === selectedExample);
        if (!example || example.code !== nextCode) {
          nextSelectedExample = CUSTOM_SNIPPET_ID;
          setSelectedExample(CUSTOM_SNIPPET_ID);
          playgroundDebug.log("code desynced from example", { selectedExample });
        }
      }

      if (nextSelectedExample === CUSTOM_SNIPPET_ID) {
        persistSession(CUSTOM_SNIPPET_ID, language, nextCode);
      }
    },
    [language, persistSession, selectedExample],
  );

  const handleReset = () => {
    playback.goToStart();
    playback.setIsPlaying(false);
  };

  const { min: editorMin, max: editorMax } = editorBounds(editorPlacement);

  const setEditorPlacementSafe = (placement: EditorPlacement) => {
    const { min, max } = editorBounds(placement);
    const nextRatio = clampRatio(editorRatio, min, max);
    setEditorPlacement(placement);
    setEditorRatio(nextRatio);
    persistPreferences(true, {
      editorPlacement: placement,
      editorRatio: nextRatio,
    });
  };

  const setEditorRatioSafe = (ratio: number) => {
    setEditorRatio(clampRatio(ratio, editorMin, editorMax));
  };

  const setConsolePositionSafe = (position: ConsolePosition) => {
    setConsolePosition(position);
    persistPreferences(true, { consolePosition: position });
  };

  const setConsoleRatioSafe = (ratio: number) => {
    setConsoleRatio(clampRatio(ratio, CONSOLE_MIN, CONSOLE_MAX));
  };

  const setCurrentStepPanelCollapsedSafe = (collapsed: boolean) => {
    setCurrentStepPanelCollapsed(collapsed);
    persistPreferences(true, { currentStepPanelCollapsed: collapsed });
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
    setConsolePosition: setConsolePositionSafe,
    consoleRatio,
    currentStepPanelCollapsed,
    setCurrentStepPanelCollapsed: setCurrentStepPanelCollapsedSafe,
    runState,
    error,
    errorLine,
    teachingHint,
    steps,
    playback,
    currentStep: activeStep,
    stackFrames: activeStackFrames,
    consoleEntries: activeConsoleEntries,
    isStale,
    showRunResults,
    showPlaybackControls,
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
