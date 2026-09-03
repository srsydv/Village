import { createContext, useContext, useMemo, useState } from "react";
import {
  deleteTrip as removeTrip,
  getChats,
  getProfile,
  getTrips,
  isOnboarded,
  saveChat as persistChat,
  saveProfile as persistProfile,
  saveTrip as persistTrip,
  setOnboarded as persistOnboarded,
} from "./storage.js";

const TravelContext = createContext(null);

export function TravelProvider({ children }) {
  const [profile, setProfile] = useState(getProfile);
  const [trips, setTrips] = useState(getTrips);
  const [chats, setChats] = useState(getChats);
  const [ready, setReady] = useState(isOnboarded);

  const value = useMemo(
    () => ({
      profile,
      trips,
      chats,
      ready,
      updateProfile: (next) => {
        const merged = { ...profile, ...next };
        persistProfile(merged);
        setProfile(merged);
      },
      completeOnboarding: (next) => {
        const merged = { ...profile, ...next };
        persistProfile(merged);
        persistOnboarded();
        setProfile(merged);
        setReady(true);
      },
      addTrip: (trip) => setTrips(persistTrip(trip)),
      removeTrip: (id) => setTrips(removeTrip(id)),
      addChat: (chat) => setChats(persistChat(chat)),
    }),
    [profile, trips, chats, ready],
  );

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const ctx = useContext(TravelContext);
  if (!ctx) throw new Error("useTravel must be used inside TravelProvider");
  return ctx;
}
