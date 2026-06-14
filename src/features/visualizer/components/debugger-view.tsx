"use client";

import { motion, AnimatePresence } from "framer-motion";

import { DashboardPanel } from "@/features/visualizer/components/dashboard-panel";
import type { CallStackFrame, ConsoleEntry } from "@/types/execution";

interface DebuggerViewProps {
  frames: CallStackFrame[];
  consoleEntries: ConsoleEntry[];
  breakpoints: number[];
}

/** 2×2 debugger grid — stack, variables, breakpoints, console. */
export function DebuggerView({
  frames,
  consoleEntries,
  breakpoints,
}: DebuggerViewProps) {
  const topDown = [...frames].reverse();

  return (
    <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2">
      <DashboardPanel title="Call Stack" count={frames.length} dot="blue">
        {topDown.length === 0 ? (
          <p className="text-muted-foreground text-sm">No frames on stack</p>
        ) : (
          <div className="space-y-1.5">
            {topDown.map((frame, index) => (
              <motion.div
                key={frame.id}
                layout
                className="bg-muted/50 rounded-md border border-border/50 px-2.5 py-1.5 font-mono text-xs"
              >
                {frame.label}
                {frame.line ? (
                  <span className="text-muted-foreground ml-2">L{frame.line}</span>
                ) : null}
                {index === 0 ? (
                  <span className="text-blue-400 ml-2 text-[10px] font-bold">TOP</span>
                ) : null}
              </motion.div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <DashboardPanel title="Variables" count={0} dot="purple">
        <p className="text-muted-foreground text-sm">
          Variable tracking arrives in Phase 3 — scope chain &amp; closures.
        </p>
      </DashboardPanel>

      <DashboardPanel title="Breakpoints" count={breakpoints.length} dot="red">
        {breakpoints.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Click a line number in the editor to add a breakpoint.
          </p>
        ) : (
          <ul className="space-y-1">
            {breakpoints.map((line) => (
              <li
                key={line}
                className="flex items-center gap-2 font-mono text-xs"
              >
                <span className="size-2 rounded-full bg-red-400" />
                Line {line}
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>

      <DashboardPanel
        title="Console"
        count={consoleEntries.length}
        dot="green"
        bodyClassName="font-mono text-sm"
      >
        <AnimatePresence mode="popLayout">
          {consoleEntries.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No output yet — press Visualize to run your code.
            </p>
          ) : (
            consoleEntries.map((entry) => (
              <motion.p key={entry.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <span className="text-emerald-500/80">&gt; </span>
                {entry.values.join(" ")}
              </motion.p>
            ))
          )}
        </AnimatePresence>
      </DashboardPanel>
    </div>
  );
}
