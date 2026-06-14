import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

import { HintLabel } from "@/components/shared/hint-label";

type Accent = "teal" | "amber" | "rose" | "slate";

const accentBorder: Record<Accent, string> = {
  teal: "border-l-teal-400",
  amber: "border-l-amber-400",
  rose: "border-l-rose-400",
  slate: "border-l-border",
};

interface LensPanelProps {
  label: string;
  tooltip: string;
  hint?: string;
  accent?: Accent;
  className?: string;
  children: ReactNode;
}

/** ExecLens panel — left accent stripe with hover tooltip on title. */
export function LensPanel({
  label,
  tooltip,
  hint,
  accent = "slate",
  className,
  children,
}: LensPanelProps) {
  return (
    <section
      className={cn(
        "bg-card/50 flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 border-l-[3px]",
        accentBorder[accent],
        className,
      )}
    >
      <header className="flex shrink-0 items-baseline justify-between gap-2 px-3 py-2">
        <HintLabel
          label={label}
          tip={tooltip}
          className="text-sm font-semibold tracking-widest uppercase opacity-90"
        />
        {hint ? (
          <span className="text-muted-foreground font-mono text-xs">{hint}</span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3">{children}</div>
    </section>
  );
}
