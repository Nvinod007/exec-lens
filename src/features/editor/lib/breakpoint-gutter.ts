import { GutterMarker, EditorView, gutter } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

class BreakpointMarker extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-breakpoint-dot";
    dot.title = "Breakpoint";
    return dot;
  }
}

const marker = new BreakpointMarker();

/** Breakpoint gutter — reads live list via getter, toggles via callback. */
export function createBreakpointGutter(
  getBreakpoints: () => number[],
  onToggle: (line: number) => void,
) {
  return [
    gutter({
      class: "cm-breakpoint-gutter",
      markers: (view) => {
        const builder = new RangeSetBuilder<GutterMarker>();
        for (const lineNumber of getBreakpoints()) {
          if (lineNumber < 1 || lineNumber > view.state.doc.lines) continue;
          const line = view.state.doc.line(lineNumber);
          builder.add(line.from, line.from, marker);
        }
        return builder.finish();
      },
      domEventHandlers: {
        mousedown(view, line, event) {
          event.preventDefault();
          onToggle(view.state.doc.lineAt(line.from).number);
          return true;
        },
      },
    }),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains("cm-lineNumber")) return false;
        const line = view.state.doc.lineAt(view.posAtDOM(target));
        onToggle(line.number);
        return true;
      },
    }),
  ];
}
