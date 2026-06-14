"use client";

import {
  useCallback,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";
import { GripHorizontal, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

interface ResizableSplitProps {
  direction: "horizontal" | "vertical";
  ratio: number;
  minRatio: number;
  maxRatio: number;
  onRatioChange: (ratio: number) => void;
  first: ReactNode;
  second: ReactNode;
  className?: string;
  onHandleDoubleClick?: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Drag handle between two panels with min/max ratio constraints. */
export function ResizableSplit({
  direction,
  ratio,
  minRatio,
  maxRatio,
  onRatioChange,
  first,
  second,
  className,
  onHandleDoubleClick,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const next =
        direction === "horizontal"
          ? (event.clientX - rect.left) / rect.width
          : (event.clientY - rect.top) / rect.height;
      onRatioChange(clamp(next, minRatio, maxRatio));
    },
    [direction, maxRatio, minRatio, onRatioChange],
  );

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const isHorizontal = direction === "horizontal";
  const HandleIcon = isHorizontal ? GripVertical : GripHorizontal;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1",
        isHorizontal ? "flex-row" : "flex-col",
        className,
      )}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flex: `${ratio} 1 0%` }}
      >
        {first}
      </div>

      <div
        role="separator"
        aria-orientation={isHorizontal ? "vertical" : "horizontal"}
        onPointerDown={onPointerDown}
        onDoubleClick={onHandleDoubleClick}
        className={cn(
          "group bg-border/40 hover:bg-primary/30 active:bg-primary/40 z-10 flex shrink-0 items-center justify-center transition-colors",
          isHorizontal ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
        )}
      >
        <HandleIcon className="text-muted-foreground group-hover:text-primary size-3 opacity-0 group-hover:opacity-100" />
      </div>

      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{ flex: `${1 - ratio} 1 0%` }}
      >
        {second}
      </div>
    </div>
  );
}
