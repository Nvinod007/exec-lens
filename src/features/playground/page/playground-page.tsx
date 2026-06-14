"use client";

import { useMemo } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PlaygroundBody } from "@/features/playground/components/playground-body";
import { PlaygroundHeader } from "@/features/playground/components/playground-header";
import { usePlaygroundShortcuts } from "@/features/playground/hooks/use-playground-shortcuts";
import { usePlaygroundState } from "@/features/playground/hooks/use-playground-state";

/** Resizable playground — unified runtime dashboard + dockable console. */
export function PlaygroundPage() {
  const {
    code,
    setCode,
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
    currentStep,
    stackFrames,
    consoleEntries,
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
  } = usePlaygroundState();

  const canPlay = showPlayback && runState !== "running";

  const editorShortcuts = useMemo(
    () => ({
      onRun: handleRun,
      runDisabled: () => runState === "running",
      onPlayToggle: () => playback.setIsPlaying((v) => !v),
      onFirst: playback.goToStart,
      onPrev: playback.stepBackward,
      onNext: playback.stepForward,
      onLast: playback.goToEnd,
      playbackEnabled: () => showPlayback,
      canPlay: () => canPlay,
    }),
    [
      canPlay,
      handleRun,
      playback.goToEnd,
      playback.goToStart,
      playback.setIsPlaying,
      playback.stepBackward,
      playback.stepForward,
      runState,
      showPlayback,
    ],
  );

  usePlaygroundShortcuts({
    isRunning: runState === "running",
    showPlayback,
    canPlay,
    onRun: handleRun,
    onPlayToggle: () => playback.setIsPlaying((v) => !v),
    onFirst: playback.goToStart,
    onPrev: playback.stepBackward,
    onNext: playback.stepForward,
    onLast: playback.goToEnd,
    onReset: handleReset,
  });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <PlaygroundHeader
          stackFrames={stackFrames}
          breakpointCount={breakpoints.length}
          currentStepIndex={showPlayback ? playback.currentIndex : 0}
          totalSteps={showPlayback ? playback.totalSteps : 0}
          editorPlacement={editorPlacement}
          selectedExample={selectedExample}
          language={language}
          runState={runState}
          showPlayback={showPlayback}
          isPlaying={playback.isPlaying}
          isStale={isStale}
          error={error ?? undefined}
          errorLine={errorLine}
          onEditorPlacementChange={setEditorPlacementSafe}
          onExampleChange={handleExampleChange}
          onLanguageChange={handleLanguageChange}
          onRun={handleRun}
          onReset={handleReset}
          onPlayToggle={() => playback.setIsPlaying((v) => !v)}
          onFirst={playback.goToStart}
          onPrev={playback.stepBackward}
          onNext={playback.stepForward}
          onLast={playback.goToEnd}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PlaygroundBody
            consolePosition={consolePosition}
            consoleRatio={consoleRatio}
            consoleEntries={consoleEntries}
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
            isRunning={playback.isPlaying || runState === "running"}
            editorShortcuts={editorShortcuts}
            onCodeChange={setCode}
            onToggleBreakpoint={handleToggleBreakpoint}
            onEditorRatioChange={setEditorRatioSafe}
            onConsolePositionChange={setConsolePosition}
            onConsoleRatioChange={setConsoleRatioSafe}
          />
        </main>
      </div>
    </TooltipProvider>
  );
}
