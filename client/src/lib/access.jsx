import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchBillingStatus } from "./api.js";
import { allowGemini, detectRegion } from "./region.js";
import { useTravel } from "./TravelContext.jsx";

const AccessContext = createContext(null);

export function AccessProvider({ children }) {
  const { signedIn } = useTravel();
  const [ready, setReady] = useState(false);
  const [region, setRegion] = useState("");
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    let cancel = false;
    setReady(false);
    (async () => {
      const code = await detectRegion();
      let next = null;
      if (signedIn) {
        try {
          const status = await fetchBillingStatus();
          next = status.subscription || null;
        } catch {
          next = null;
        }
      }
      if (cancel) return;
      allowGemini(code === "IN" || Boolean(next?.active));
      setRegion(code);
      setSubscription(next);
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, [signedIn]);

  const value = useMemo(() => {
    const entitled = region === "IN" || Boolean(subscription?.active);
    return {
      ready,
      region,
      subscription,
      entitled,
      setSubscription(next) {
        allowGemini(region === "IN" || Boolean(next?.active));
        setSubscription(next);
      },
    };
  }, [ready, region, subscription]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("useAccess must be used inside AccessProvider");
  return value;
}
