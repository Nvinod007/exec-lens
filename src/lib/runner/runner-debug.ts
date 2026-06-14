const enabled = process.env.NODE_ENV !== "production";

/** Dev-only runner logger — silent in production builds. */
export const runnerDebug = {
  log(message: string, data?: Record<string, unknown>) {
    if (!enabled) return;
    if (data) {
      console.log(`[exec-lens:runner] ${message}`, data);
      return;
    }
    console.log(`[exec-lens:runner] ${message}`);
  },
};
