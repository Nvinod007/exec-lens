import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type PanelTone = "macrotask" | "microtask" | "stack" | "loop" | "console" | "editor";

const toneStyles: Record<PanelTone, string> = {
  macrotask: "bg-panel-macrotask text-panel-foreground",
  microtask: "bg-panel-microtask text-panel-foreground",
  stack: "bg-panel-stack text-panel-foreground",
  loop: "bg-panel-loop text-panel-foreground",
  console: "bg-panel-console text-panel-foreground",
  editor: "bg-panel-editor text-panel-foreground",
};

interface RuntimePanelProps {
  title: string;
  tone: PanelTone;
  className?: string;
  children: ReactNode;
}

/** Flat JSV9000-style panel — label in corner, solid fill, no card chrome. */
export function RuntimePanel({
  title,
  tone,
  className,
  children,
}: RuntimePanelProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col rounded border-2 border-black/15 shadow-sm dark:border-white/15",
        toneStyles[tone],
        className,
      )}
    >
      <span className="absolute top-2 left-3 z-10 text-sm font-bold tracking-tight">
        {title}
      </span>
      <div className="flex min-h-0 flex-1 flex-col pt-9 pb-2.5 px-2.5">{children}</div>
    </div>
  );
}
