"use client";

import { useEffect } from "react";

/** Registers a static offline shell; user data and premium content are never cached. */
export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
