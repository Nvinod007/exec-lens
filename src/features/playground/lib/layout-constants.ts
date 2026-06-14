export type EditorPlacement = "left" | "right" | "top";
export type ConsolePosition = "top" | "bottom";

export const EDITOR_MIN = 0.22;
export const EDITOR_MAX = 0.55;
export const EDITOR_TOP_MIN = 0.2;
export const EDITOR_TOP_MAX = 0.5;
export const CONSOLE_MIN = 0.16;
export const CONSOLE_MAX = 0.4;
export const CONSOLE_DEFAULT = 0.2;

export function clampRatio(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function editorBounds(placement: EditorPlacement) {
  return placement === "top"
    ? { min: EDITOR_TOP_MIN, max: EDITOR_TOP_MAX }
    : { min: EDITOR_MIN, max: EDITOR_MAX };
}
