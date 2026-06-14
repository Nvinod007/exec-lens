import { Box, Database, Layers, Variable } from "lucide-react";

interface RuntimeStatsBarProps {
  stackFrames: number;
  variableCount: number;
  stackBlocks: number;
  heapObjects: number;
}

/** Top metrics strip — frames, variables, memory (Code Visualizer style). */
export function RuntimeStatsBar({
  stackFrames,
  variableCount,
  stackBlocks,
  heapObjects,
}: RuntimeStatsBarProps) {
  const items = [
    {
      icon: Layers,
      label: "Call Stack",
      value: `${stackFrames} frame${stackFrames === 1 ? "" : "s"}`,
      accent: "text-blue-400",
    },
    {
      icon: Variable,
      label: "Variables",
      value: `${variableCount} tracked`,
      accent: "text-violet-400",
    },
    {
      icon: Database,
      label: "Stack Memory",
      value: `${stackBlocks} block${stackBlocks === 1 ? "" : "s"}`,
      accent: "text-amber-400",
    },
    {
      icon: Box,
      label: "Heap Memory",
      value: `${heapObjects} object${heapObjects === 1 ? "" : "s"}`,
      accent: "text-emerald-400",
    },
  ] as const;

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-card/60 flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2"
        >
          <item.icon className={`size-4 shrink-0 ${item.accent}`} />
          <div className="min-w-0">
            <p className="text-muted-foreground truncate text-[10px] font-medium uppercase">
              {item.label}
            </p>
            <p className="truncate font-mono text-xs font-semibold">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
