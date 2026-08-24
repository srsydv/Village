import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore */
      });
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);
  return null;
}
