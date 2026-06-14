/**
 * localStorage keys (browser-only, no backend):
 * - execlens:v1:preferences — layout (editor/console placement + ratios)
 * - execlens:v1:session — last snippet (example id or custom draft)
 *
 * Theme is persisted by next-themes (default key: "theme"), not here.
 */

import { CUSTOM_SNIPPET_ID } from "@/features/examples/constants";

import {
  CONSOLE_DEFAULT,
  type ConsolePosition,
  type EditorPlacement,
} from "@/features/playground/lib/layout-constants";

export const STORAGE_VERSION = 1;
export const PREFERENCES_KEY = "execlens:v1:preferences";
export const SESSION_KEY = "execlens:v1:session";
export const MAX_SNIPPET_LENGTH = 20_000;

export interface PlaygroundPreferences {
  version: typeof STORAGE_VERSION;
  editorPlacement: EditorPlacement;
  consolePosition: ConsolePosition;
  editorRatio: number;
  consoleRatio: number;
  currentStepPanelCollapsed: boolean;
}

export interface CustomDraft {
  code: string;
  language: "javascript" | "typescript";
  savedAt: string;
  label: string;
}

export interface PlaygroundSession {
  version: typeof STORAGE_VERSION;
  selectedExample: string;
  language: "javascript" | "typescript";
  customDraft?: CustomDraft;
}

const DEFAULT_PREFERENCES: PlaygroundPreferences = {
  version: STORAGE_VERSION,
  editorPlacement: "left",
  consolePosition: "bottom",
  editorRatio: 0.42,
  consoleRatio: CONSOLE_DEFAULT,
  currentStepPanelCollapsed: false,
};

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private browsing — ignore.
  }
}

function isEditorPlacement(value: unknown): value is EditorPlacement {
  return value === "left" || value === "right" || value === "top";
}

function isConsolePosition(value: unknown): value is ConsolePosition {
  return value === "top" || value === "bottom";
}

function isLanguage(value: unknown): value is "javascript" | "typescript" {
  return value === "javascript" || value === "typescript";
}

function isFiniteRatio(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parsePreferences(raw: unknown): PlaygroundPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<PlaygroundPreferences>;
  if (data.version !== STORAGE_VERSION) return null;
  if (!isEditorPlacement(data.editorPlacement)) return null;
  if (!isConsolePosition(data.consolePosition)) return null;
  if (!isFiniteRatio(data.editorRatio) || !isFiniteRatio(data.consoleRatio)) {
    return null;
  }
  return {
    version: STORAGE_VERSION,
    editorPlacement: data.editorPlacement,
    consolePosition: data.consolePosition,
    editorRatio: data.editorRatio,
    consoleRatio: data.consoleRatio,
    currentStepPanelCollapsed:
      typeof data.currentStepPanelCollapsed === "boolean"
        ? data.currentStepPanelCollapsed
        : false,
  };
}

function parseCustomDraft(raw: unknown): CustomDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<CustomDraft>;
  if (typeof data.code !== "string" || !isLanguage(data.language)) return null;
  if (typeof data.savedAt !== "string" || typeof data.label !== "string") {
    return null;
  }
  if (data.code.length > MAX_SNIPPET_LENGTH) return null;
  return {
    code: data.code,
    language: data.language,
    savedAt: data.savedAt,
    label: data.label,
  };
}

function parseSession(raw: unknown): PlaygroundSession | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<PlaygroundSession>;
  if (data.version !== STORAGE_VERSION) return null;
  if (typeof data.selectedExample !== "string" || !isLanguage(data.language)) {
    return null;
  }
  const customDraft =
    data.customDraft === undefined
      ? undefined
      : parseCustomDraft(data.customDraft) ?? undefined;
  if (data.selectedExample === CUSTOM_SNIPPET_ID && !customDraft) return null;
  return {
    version: STORAGE_VERSION,
    selectedExample: data.selectedExample,
    language: data.language,
    ...(customDraft ? { customDraft } : {}),
  };
}

export function loadPreferences(): PlaygroundPreferences {
  return parsePreferences(readJson(PREFERENCES_KEY)) ?? DEFAULT_PREFERENCES;
}

export function savePreferences(prefs: Omit<PlaygroundPreferences, "version">): void {
  writeJson(PREFERENCES_KEY, { version: STORAGE_VERSION, ...prefs });
}

export function loadSession(): PlaygroundSession | null {
  return parseSession(readJson(SESSION_KEY));
}

export function saveSession(session: Omit<PlaygroundSession, "version">): void {
  writeJson(SESSION_KEY, { version: STORAGE_VERSION, ...session });
}

export function buildCustomDraftLabel(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `custom-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export function buildCustomDraft(
  code: string,
  language: "javascript" | "typescript",
): CustomDraft | null {
  if (code.length > MAX_SNIPPET_LENGTH) return null;
  return {
    code,
    language,
    savedAt: new Date().toISOString(),
    label: buildCustomDraftLabel(),
  };
}
