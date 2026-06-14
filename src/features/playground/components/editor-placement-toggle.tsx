import { LayoutPanelLeft, LayoutPanelTop } from "lucide-react";

import { ActionTooltip } from "@/components/shared/action-tooltip";
import type { EditorPlacement } from "@/features/playground/lib/layout-constants";
import { cn } from "@/lib/utils";

const PLACEMENTS = [
  { id: "left" as const, icon: LayoutPanelLeft, label: "Left", flip: false },
  { id: "top" as const, icon: LayoutPanelTop, label: "Top", flip: false },
  { id: "right" as const, icon: LayoutPanelLeft, label: "Right", flip: true },
] as const;

interface EditorPlacementToggleProps {
  value: EditorPlacement;
  onChange: (placement: EditorPlacement) => void;
}

/** Toggle editor pane position — left, top, or right of the runtime dashboard. */
export function EditorPlacementToggle({ value, onChange }: EditorPlacementToggleProps) {
  return (
    <div className="bg-muted/40 flex rounded-lg p-0.5">
      {PLACEMENTS.map(({ id, icon: Icon, label, flip }) => (
        <ActionTooltip key={id} label={label}>
          <button
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              value === id
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label={`Editor ${label.toLowerCase()}`}
          >
            <Icon className={cn("size-3.5", flip && "scale-x-[-1]")} />
          </button>
        </ActionTooltip>
      ))}
    </div>
  );
}
