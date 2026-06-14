"use client";

import { motion, AnimatePresence } from "framer-motion";

import { RuntimePanel } from "@/features/visualizer/components/runtime-panel";
import type { CallStackFrame } from "@/types/execution";

interface CallStackPanelProps {
  frames: CallStackFrame[];
}

/** Vertical LIFO stack — push down, pop from top. */
export function CallStackPanel({ frames }: CallStackPanelProps) {
  const topDown = [...frames].reverse();

  return (
    <RuntimePanel title="Call Stack" tone="stack" className="min-h-0 flex-1">
      <div className="flex h-full min-h-[140px] flex-col">
        <p className="mb-1 text-center text-[10px] font-bold opacity-50">POP ↑</p>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {topDown.length === 0 ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="m-auto text-sm opacity-50"
              >
                empty
              </motion.p>
            ) : (
              topDown.map((frame, index) => (
                <motion.div
                  key={frame.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="bg-panel-item rounded border border-black/10 px-3 py-2 font-mono text-sm shadow-sm dark:border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <span>{frame.label}</span>
                    {frame.async ? (
                      <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                        {frame.suspended ? "await" : "async"}
                      </span>
                    ) : null}
                  </span>
                  {index === 0 ? (
                    <span className="float-right text-[10px] font-bold opacity-70">
                      top
                    </span>
                  ) : null}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <p className="mt-1 text-center text-[10px] font-bold opacity-50">PUSH ↓</p>
      </div>
    </RuntimePanel>
  );
}
