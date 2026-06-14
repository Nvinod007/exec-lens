"use client";

import type { ReactNode } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HintLabelProps {
  label: string;
  tip: string;
  hint?: string;
  className?: string;
}

/** Label with hover tooltip for self-explanatory metrics. */
export function HintLabel({ label, tip, hint, className }: HintLabelProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "cursor-help border-b border-dotted border-muted-foreground/35",
            className,
          )}
        >
          {label}
          {hint ? (
            <span className="text-muted-foreground ml-1.5 font-mono text-xs">
              {hint}
            </span>
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="bg-popover text-popover-foreground border-border max-w-[240px] border text-xs leading-relaxed"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

interface HintChipProps {
  label: string;
  tip: string;
  children: ReactNode;
}

/** Metric chip with tooltip. */
export function HintChip({ label, tip, children }: HintChipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="bg-muted/60 cursor-help rounded-full px-2.5 py-1 font-mono text-xs">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        className="bg-popover text-popover-foreground border-border max-w-[220px] border text-xs"
      >
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground"> — {tip}</span>
      </TooltipContent>
    </Tooltip>
  );
}
