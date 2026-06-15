import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import { GutterMarker, gutter } from "@codemirror/view";

class BreakpointMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint-dot";
    dot.title = "Breakpoint";
    return dot;
  }
}

const marker = new BreakpointMarker();

export const setBreakpointsEffect = StateEffect.define<number[]>();

const breakpointsField = StateField.define<number[]>({
  create() {
    return [];
  },
  update(lines, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setBreakpointsEffect)) return effect.value;
    }
    return lines;
  },
});

/** Breakpoint gutter — toggles via callback; markers synced from `setBreakpointsEffect`. */
export function createBreakpointGutter(onToggle: (line: number) => void) {
  return [
    breakpointsField,
    gutter({
      class: "cm-breakpoint-gutter",
      markers: (view) => {
        const builder = new RangeSetBuilder<GutterMarker>();
        for (const lineNumber of view.state.field(breakpointsField)) {
          if (lineNumber < 1 || lineNumber > view.state.doc.lines) continue;
          const line = view.state.doc.line(lineNumber);
          builder.add(line.from, line.from, marker);
        }
        return builder.finish();
      },
      lineMarkerChange: (update) =>
        update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(setBreakpointsEffect)),
        ),
      domEventHandlers: {
        mousedown(view, line, event) {
          event.preventDefault();
          onToggle(view.state.doc.lineAt(line.from).number);
          return true;
        },
      },
    }),
  ];
}
