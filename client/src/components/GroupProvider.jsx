import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearSession,
  getLocalMembers,
  getLocalTransactions,
  loadSession,
  pendingCount,
  pullSnapshot,
  saveSession,
  syncNow,
} from "../lib/offline/sync.js";
import { computeBalances } from "../lib/balances.js";

const GroupContext = createContext(null);

export function GroupProvider({ children }) {
  const [session, setSessionState] = useState(null);
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
  );
  const [loading, setLoading] = useState(true);

  const refreshLocal = useCallback(async (s) => {
    const current = s ?? loadSession();
    if (!current) {
      setMembers([]);
      setTransactions([]);
      setPending(0);
      return;
    }
    const [m, t, p] = await Promise.all([
      getLocalMembers(current.groupId),
      getLocalTransactions(current.groupId),
      pendingCount(current.groupId),
    ]);
    setMembers(m);
    setTransactions(t);
    setPending(p);
  }, []);

  const sync = useCallback(async () => {
    const current = loadSession();
    if (!current || !navigator.onLine) return;
    await syncNow(current.token, current.groupId);
    await refreshLocal(current);
  }, [refreshLocal]);

  useEffect(() => {
    const s = loadSession();
    (async () => {
      if (s) {
        setSessionState(s);
        await refreshLocal(s);
        if (navigator.onLine) {
          try {
            await pullSnapshot(s.token, s.groupId);
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
      await saveSession(s);
      setSessionState(s);
      await refreshLocal(s);
      if (navigator.onLine) {
        await pullSnapshot(s.token, s.groupId);
        await refreshLocal(s);
      }
    },
    [refreshLocal],
  );

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
    setMembers([]);
    setTransactions([]);
    setPending(0);
  }, []);

  const value = useMemo(
    () => ({
      session,
      members,
      transactions,
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
      members,
      transactions,
      pending,
      online,
      loading,
      setSession,
      logout,
      refreshLocal,
      sync,
    ],
  );

  return (
    <GroupContext.Provider value={value}>{children}</GroupContext.Provider>
  );
}

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroup must be used inside GroupProvider");
  return ctx;
}

export function useComputedBalances() {
  const { members, transactions } = useGroup();
  return useMemo(
    () => computeBalances(members, transactions),
    [members, transactions],
  );
}
