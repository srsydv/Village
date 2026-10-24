import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    const native = Boolean(window.Capacitor?.isNativePlatform?.());
    if (native) {
      navigator.serviceWorker.getRegistrations?.().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      }).catch(() => {});
      return undefined;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    return undefined;
  }, []);
  return null;
}
