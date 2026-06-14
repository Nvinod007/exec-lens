"use client";

import { useEffect, useState } from "react";

/** True when the primary modifier should display as ⌘ (macOS / iOS). */
export function useIsMac() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPod|iPad/i.test(navigator.platform));
  }, []);

  return isMac;
}
