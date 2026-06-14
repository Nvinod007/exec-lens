"use client";

import { motion, AnimatePresence } from "framer-motion";

import { RuntimePanel } from "@/features/visualizer/components/runtime-panel";
import type { QueueItem } from "@/types/execution";

interface QueuePanelProps {
  title: string;
  items: QueueItem[];
  variant: "microtask" | "macrotask";
}

/** Horizontal FIFO queue — dequeue left, enqueue right. */
export function QueuePanel({ title, items, variant }: QueuePanelProps) {
  const tone = variant === "microtask" ? "microtask" : "macrotask";

  return (
    <RuntimePanel title={title} tone={tone} className="h-[88px] shrink-0">
      <div className="flex h-full items-center gap-2">
        <span className="shrink-0 text-[10px] font-bold opacity-60">OUT ←</span>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <AnimatePresence mode="popLayout">
            {items.length === 0 ? (
              <motion.span
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm opacity-50"
              >
                empty
              </motion.span>
            ) : (
              items.map((item, index) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="bg-panel-item shrink-0 rounded border border-black/10 px-3 py-1.5 font-mono text-sm shadow-sm dark:border-white/10"
                >
                  {item.label}
                  {index === 0 ? (
                    <span className="ml-1.5 text-[10px] font-bold opacity-70">
                      ← next
                    </span>
                  ) : null}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <span className="shrink-0 text-[10px] font-bold opacity-60">→ IN</span>
      </div>
    </RuntimePanel>
  );
}
