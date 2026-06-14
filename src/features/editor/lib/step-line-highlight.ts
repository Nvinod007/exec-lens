import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";

const stepLineMark = Decoration.line({ class: "cm-stepLine" });

export const setStepLineEffect = StateEffect.define<number | undefined>();

export const stepLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setStepLineEffect)) {
        const lineNo = effect.value;
        if (lineNo == null || lineNo < 1 || lineNo > tr.state.doc.lines) {
          return Decoration.none;
        }
        const line = tr.state.doc.line(lineNo);
        return Decoration.set([stepLineMark.range(line.from)]);
      }
    }
    return deco.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});
