import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchBillingStatus } from "./api.js";
import { useTravel } from "./TravelContext.jsx";

const AccessContext = createContext(null);
const OPEN_TRIPS = { used: 0, limit: 2, allowed: true };

export function AccessProvider({ children }) {
  const { signedIn } = useTravel();
  const [ready, setReady] = useState(false);
  const [subscription, setSubscriptionState] = useState(null);
  const [trips, setTrips] = useState(OPEN_TRIPS);

  useEffect(() => {
    let cancel = false;
    setReady(false);
    (async () => {
      let next = null;
      let allowance = OPEN_TRIPS;
      if (signedIn) {
        try {
          const status = await fetchBillingStatus();
          next = status.subscription || null;
          if (status.trips) allowance = status.trips;
        } catch {
          next = null;
        }
      }
      if (cancel) return;
      setSubscriptionState(next);
      setTrips(allowance);
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, [signedIn]);

  const value = useMemo(() => {
    const active = Boolean(subscription?.active);
    const limit = trips.limit || 2;
    const used = trips.used || 0;
    return {
      ready,
      subscription,
      entitled: true,
      canCreateTrip: active || trips.allowed !== false,
      tripsLeft: active ? null : Math.max(0, limit - used),
      setSubscription(next) {
        setSubscriptionState(next);
        if (next?.active) setTrips((current) => ({ ...current, allowed: true }));
      },
      markTripUsed() {
        setTrips((current) => ({ ...current, used: current.limit || 2, allowed: false }));
      },
    };
  }, [ready, subscription, trips]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const value = useContext(AccessContext);
  if (!value) throw new Error("useAccess must be used inside AccessProvider");
  return value;
}
