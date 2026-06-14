"use client";

import { RuntimePanel } from "@/features/visualizer/components/runtime-panel";
import type { ConsoleEntry } from "@/types/execution";

interface ConsolePanelProps {
  entries: ConsoleEntry[];
}

/** Console output strip at the bottom of the runtime view. */
export function ConsolePanel({ entries }: ConsolePanelProps) {
  return (
    <RuntimePanel title="Console" tone="console" className="h-[72px] shrink-0">
      <div className="overflow-y-auto font-mono text-sm">
        {entries.length === 0 ? (
          <span className="opacity-50">&gt; </span>
        ) : (
          entries.map((entry) => (
            <p key={entry.id}>
              <span className="opacity-50">&gt; </span>
              {entry.values.join(" ")}
            </p>
          ))
        )}
      </div>
    </RuntimePanel>
  );
}
