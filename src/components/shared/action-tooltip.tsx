"use client";

import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { useIsMac } from "@/hooks/use-is-mac";
import { formatShortcutBinding } from "@/lib/keyboard/format-shortcut";
import type { ShortcutBinding } from "@/lib/keyboard/shortcuts";
import { cn } from "@/lib/utils";

interface ActionTooltipProps {
  label: string;
  shortcut?: ShortcutBinding;
  detail?: string;
  children: React.ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/** One-word action label + OS-aware shortcut on hover. */
export function ActionTooltip({
  label,
  shortcut,
  detail,
  children,
  side = "bottom",
  className,
}: ActionTooltipProps) {
  const isMac = useIsMac();
  const shortcutLabel = shortcut ? formatShortcutBinding(shortcut, isMac) : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        className={cn(
          "bg-popover text-popover-foreground border-border flex items-center gap-3 border px-2.5 py-1.5 text-xs",
          className,
        )}
      >
        <span className="font-medium">{label}</span>
        {shortcutLabel ? <Kbd>{shortcutLabel}</Kbd> : null}
        {detail ? (
          <span className="text-muted-foreground border-border border-l pl-3">{detail}</span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
