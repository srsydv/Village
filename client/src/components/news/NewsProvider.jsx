import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  authHeaders,
  clearNewsSession,
  loadNewsSession,
  saveNewsSession,
} from "../../lib/news/session.js";
import { connectNewsSocket, disconnectNewsSocket } from "../../lib/news/socket.js";

const NewsContext = createContext(null);

export function NewsProvider({ children }) {
  const [session, setSessionState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [socketLive, setSocketLive] = useState(false);

  const setSession = useCallback((s) => {
    saveNewsSession(s);
    setSessionState(s);
  }, []);

  const logout = useCallback(() => {
    clearNewsSession();
    disconnectNewsSocket();
    setSessionState(null);
  }, []);

  useEffect(() => {
    const stored = loadNewsSession();
    if (!stored?.token) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/news/me", {
          headers: authHeaders(stored.token),
        });
        if (!res.ok) {
          clearNewsSession();
          setSessionState(null);
        } else {
          const data = await res.json();
          const next = { token: stored.token, user: data.user };
          saveNewsSession(next);
          setSessionState(next);
        }
      } catch {
        setSessionState(stored);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!session?.token) {
      disconnectNewsSocket();
      return;
    }
    connectNewsSocket(session.token, {
      onAlert: (payload) => setAlert(payload),
      onStatus: (live) => setSocketLive(live),
    });
    return () => disconnectNewsSocket();
  }, [session?.token]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user || null,
      token: session?.token || "",
      loading,
      alert,
      clearAlert: () => setAlert(null),
      socketLive,
      setSession,
      logout,
    }),
    [session, loading, alert, socketLive, setSession, logout],
  );

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNews() {
  const ctx = useContext(NewsContext);
  if (!ctx) throw new Error("useNews must be used inside NewsProvider");
  return ctx;
}
