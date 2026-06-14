import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type DotColor = "blue" | "purple" | "yellow" | "green" | "red" | "none";

const dotStyles: Record<Exclude<DotColor, "none">, string> = {
  blue: "bg-blue-400",
  purple: "bg-violet-400",
  yellow: "bg-amber-400",
  green: "bg-emerald-400",
  red: "bg-red-400",
};

interface DashboardPanelProps {
  title: string;
  count?: number | string;
  dot?: DotColor;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Code Visualizer–style panel with header badge and scroll body. */
export function DashboardPanel({
  title,
  count,
  dot = "none",
  className,
  bodyClassName,
  children,
}: DashboardPanelProps) {
  return (
    <div
      className={cn(
        "bg-card/80 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border/70",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2">
        {dot !== "none" ? (
          <span className={cn("size-2 shrink-0 rounded-full", dotStyles[dot])} />
        ) : null}
        <span className="text-[11px] font-semibold tracking-wide uppercase">
          {title}
        </span>
        {count !== undefined ? (
          <span className="bg-muted/80 text-muted-foreground ml-auto rounded-full px-2 py-0.5 font-mono text-[10px]">
            {count}
          </span>
        ) : null}
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto p-3", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
