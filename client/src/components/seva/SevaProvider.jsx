import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearSevaSession,
  getLocalJobs,
  getLocalWorkers,
  loadSevaSession,
  pendingSevaCount,
  pullSevaSnapshot,
  saveSevaSession,
  syncSevaNow,
} from "../../lib/seva/sync.js";

const SevaContext = createContext(null);

export function SevaProvider({ children }) {
  const [session, setSessionState] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
  );
  const [loading, setLoading] = useState(true);

  const refreshLocal = useCallback(async (s) => {
    const current = s ?? loadSevaSession();
    if (!current) {
      setWorkers([]);
      setJobs([]);
      setPending(0);
      return;
    }
    const [w, j, p] = await Promise.all([
      getLocalWorkers(current.villageId),
      getLocalJobs(current.villageId),
      pendingSevaCount(current.villageId),
    ]);
    setWorkers(w.filter((x) => x.isActive !== false));
    setJobs(j);
    setPending(p);
  }, []);

  const sync = useCallback(async () => {
    const current = loadSevaSession();
    if (!current || !navigator.onLine) return;
    await syncSevaNow(current.token, current.villageId);
    await refreshLocal(current);
  }, [refreshLocal]);

  useEffect(() => {
    const s = loadSevaSession();
    (async () => {
      if (s) {
        setSessionState(s);
        await refreshLocal(s);
        if (navigator.onLine) {
          try {
            await pullSevaSnapshot(s.token, s.villageId);
            await refreshLocal(s);
          } catch {
            /* keep local */
          }
        }
      }
      setLoading(false);
    })();
  }, [refreshLocal]);

  useEffect(() => {
    const on = () => {
      setOnline(true);
      void sync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [sync]);

  const setSession = useCallback(
    async (s) => {
      await saveSevaSession(s);
      setSessionState(s);
      await refreshLocal(s);
      if (navigator.onLine) {
        await pullSevaSnapshot(s.token, s.villageId);
        await refreshLocal(s);
      }
    },
    [refreshLocal],
  );

  const logout = useCallback(() => {
    clearSevaSession();
    setSessionState(null);
    setWorkers([]);
    setJobs([]);
    setPending(0);
  }, []);

  const value = useMemo(
    () => ({
      session,
      workers,
      jobs,
      pending,
      online,
      loading,
      setSession,
      logout,
      refreshLocal: () => refreshLocal(),
      sync,
    }),
    [
      session,
      workers,
      jobs,
      pending,
      online,
      loading,
      setSession,
      logout,
      refreshLocal,
      sync,
    ],
  );

  return <SevaContext.Provider value={value}>{children}</SevaContext.Provider>;
}

export function useSeva() {
  const ctx = useContext(SevaContext);
  if (!ctx) throw new Error("useSeva must be used inside SevaProvider");
  return ctx;
}
