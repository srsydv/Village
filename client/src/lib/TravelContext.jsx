import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fetchAccount, syncAccount } from "./api.js";
import {
  deleteChat as removeChatRecord,
  deleteTrip as removeTrip,
  getAccount,
  getAuthToken,
  getChats,
  getProfile,
  getTrips,
  replaceChats,
  replaceTrips,
  resetLocalUser,
  saveChat as persistChat,
  saveProfile as persistProfile,
  saveSession,
  saveTrip as persistTrip,
  setOnboarded as persistOnboarded,
} from "./storage.js";

const emptyProfile = { name: "", homeCity: "", currency: "INR", nationality: "India" };
const TravelContext = createContext(null);

function signedInNow() {
  return Boolean(getAuthToken() && getAccount()?.email);
}

function profileComplete(p) {
  return Boolean(String(p?.name || "").trim() && String(p?.homeCity || "").trim());
}

export function TravelProvider({ children }) {
  const [profile, setProfile] = useState(getProfile);
  const [trips, setTrips] = useState(getTrips);
  const [chats, setChats] = useState(getChats);
  const [account, setAccount] = useState(getAccount);
  const [signedIn, setSignedIn] = useState(signedInNow);
  const [ready, setReady] = useState(() => signedInNow() && profileComplete(getProfile()));
  const [authChecked, setAuthChecked] = useState(!getAuthToken());
  const syncTimer = useRef(null);
  const stateRef = useRef({ profile, trips, chats, account });
  stateRef.current = { profile, trips, chats, account };

  const applyUser = useCallback((user, token) => {
    const nextProfile = {
      name: user.name || "",
      homeCity: user.homeCity || "",
      currency: user.currency || "INR",
      nationality: user.nationality || "India",
    };
    persistProfile(nextProfile);
    saveSession({ token: token || getAuthToken(), user });
    setProfile(nextProfile);
    setChats(user.chats?.length ? replaceChats(user.chats) : getChats());
    setTrips(user.trips?.length ? replaceTrips(user.trips) : getTrips());
    setAccount({
      email: user.email,
      name: user.name,
      picture: user.picture,
      isAdmin: Boolean(user.isAdmin),
    });
    setSignedIn(true);
    const done = profileComplete(nextProfile);
    if (done) persistOnboarded();
    setReady(done);
  }, []);

  const queueSync = useCallback(() => {
    if (!getAuthToken()) return;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      const { profile: nextProfile, chats: nextChats, trips: nextTrips } = stateRef.current;
      syncAccount({
        name: nextProfile.name,
        homeCity: nextProfile.homeCity,
        currency: nextProfile.currency,
        nationality: nextProfile.nationality,
        chats: nextChats,
        trips: nextTrips,
      }).catch(() => {});
    }, 700);
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setReady(false);
      setAuthChecked(true);
      return undefined;
    }
    let cancelled = false;
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Account check timed out.")), 7000);
    });
    Promise.race([fetchAccount(), timeout])
      .then((user) => {
        if (cancelled) return;
        if (!user) {
          resetLocalUser();
          setAccount(null);
          setProfile(emptyProfile);
          setChats([]);
          setTrips([]);
          setSignedIn(false);
          setReady(false);
          setAuthChecked(true);
          return;
        }
        applyUser(user);
        queueSync();
        setAuthChecked(true);
      })
      .catch(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyUser, queueSync]);

  const value = useMemo(
    () => ({
      profile,
      trips,
      chats,
      account,
      ready,
      authChecked,
      signedIn,
      updateProfile: (next) => {
        const merged = { ...profile, ...next };
        persistProfile(merged);
        setProfile(merged);
        queueSync();
      },
      completeOnboarding: (next) => {
        if (!getAuthToken()) return;
        const merged = { ...profile, ...next };
        persistProfile(merged);
        persistOnboarded();
        setProfile(merged);
        setReady(profileComplete(merged));
        stateRef.current = { ...stateRef.current, profile: merged };
        syncAccount({
          name: merged.name,
          homeCity: merged.homeCity,
          currency: merged.currency,
          nationality: merged.nationality,
          chats: stateRef.current.chats,
          trips: stateRef.current.trips,
        }).catch(() => {});
      },
      completeGoogleSignIn: (data) => {
        applyUser(data.user, data.token);
        queueSync();
      },
      signOut: () => {
        clearTimeout(syncTimer.current);
        try {
          window.google?.accounts?.id?.disableAutoSelect?.();
        } catch {
          /* ignore */
        }
        resetLocalUser();
        setAccount(null);
        setProfile(emptyProfile);
        setChats([]);
        setTrips([]);
        setSignedIn(false);
        setReady(false);
      },
      addTrip: (trip) => {
        const next = persistTrip(trip);
        setTrips(next);
        queueSync();
      },
      removeTrip: (id) => {
        const next = removeTrip(id);
        setTrips(next);
        queueSync();
      },
      addChat: (chat) => {
        const next = persistChat(chat);
        setChats(next);
        queueSync();
      },
      removeChat: (id) => {
        const next = removeChatRecord(id);
        setChats(next);
        queueSync();
      },
    }),
    [account, applyUser, authChecked, chats, profile, queueSync, ready, signedIn, trips],
  );

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const ctx = useContext(TravelContext);
  if (!ctx) throw new Error("useTravel must be used inside TravelProvider");
  return ctx;
}
