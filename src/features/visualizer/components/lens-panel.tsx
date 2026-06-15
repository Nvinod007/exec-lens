"use client";

import { ChevronDown } from "lucide-react";
import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { HintLabel } from "@/components/shared/hint-label";

type Accent = "teal" | "amber" | "rose" | "slate";
type Surface = "default" | "recessed";

const accentBorder: Record<Accent, string> = {
  teal: "border-l-teal-400",
  amber: "border-l-amber-400",
  rose: "border-l-rose-400",
  slate: "border-l-border",
};

const surfaceStyles: Record<Surface, string> = {
  default: "bg-card border-border/60",
  recessed: "bg-panel-surface border-border/60",
};

interface LensPanelProps {
  label: string;
  tooltip: string;
  hint?: string;
  accent?: Accent;
  surface?: Surface;
  className?: string;
  children: ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Inline summary shown beside the title when collapsed (single header row). */
  collapsedSummary?: ReactNode;
}

/** ExecLens panel — left accent stripe with hover tooltip on title. */
export function LensPanel({
  label,
  tooltip,
  hint,
  accent = "slate",
  surface = "default",
  className,
  children,
  collapsible = false,
  collapsed = false,
  onCollapsedChange,
  collapsedSummary,
}: LensPanelProps) {
  const contentId = useId();

  const toggleCollapsed = () => {
    onCollapsedChange?.(!collapsed);
  };

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl border border-l-[3px]",
        surfaceStyles[surface],
        accentBorder[accent],
        className,
      )}
    >
      <header
        className={cn(
          "flex shrink-0 items-center gap-1 px-3",
          collapsible && collapsed ? "py-1.5" : "py-2",
        )}
      >
        {collapsible ? (
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={contentId}
            onClick={toggleCollapsed}
            className="text-muted-foreground hover:text-foreground -ml-1 flex shrink-0 items-center justify-center rounded p-0.5 transition-colors"
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                collapsed && "-rotate-90",
              )}
            />
            <span className="sr-only">
              {collapsed ? "Expand" : "Collapse"} {label}
            </span>
          </button>
        ) : null}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2",
            collapsible && "cursor-pointer",
          )}
          onClick={collapsible ? toggleCollapsed : undefined}
        >
          <span
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <HintLabel
              label={label}
              tip={tooltip}
              className="text-sm font-semibold tracking-widest uppercase opacity-90"
            />
          </span>
          {collapsible && collapsed && collapsedSummary ? (
            <div className="text-muted-foreground flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm">
              {collapsedSummary}
            </div>
          ) : null}
          {hint ? (
            <span className="text-muted-foreground shrink-0 font-mono text-xs">{hint}</span>
          ) : null}
        </div>
      </header>
      {collapsed ? (
        <div id={contentId} hidden />
      ) : (
        <div id={contentId} className="min-h-0 flex-1 overflow-auto px-3 pb-3">
          {children}
        </div>
      )}
    </section>
  );
}
