const enabled = process.env.NODE_ENV !== "production";

/** Dev-only playground state logger — silent in production builds. */
export const playgroundDebug = {
  log(message: string, data?: Record<string, unknown>) {
    if (!enabled) return;
    if (data) {
      console.log(`[exec-lens:playground] ${message}`, data);
      return;
    }
    console.log(`[exec-lens:playground] ${message}`);
  },
};
