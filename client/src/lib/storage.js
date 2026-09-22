const LEGACY_KEYS = {
  profile: "aurea.profile",
  trips: "aurea.trips",
  chats: "aurea.chats",
  onboarded: "aurea.onboarded",
  visitor: "aurea.visitor",
  token: "aurea.token",
  account: "aurea.account",
};

const KEYS = {
  profile: "safar.profile",
  trips: "safar.trips",
  chats: "safar.chats",
  onboarded: "safar.onboarded",
  visitor: "safar.visitor",
  token: "safar.token",
  account: "safar.account",
};

function migrateLegacy() {
  try {
    if (localStorage.getItem("safar.migrated") === "1") return;
    for (const [name, oldKey] of Object.entries(LEGACY_KEYS)) {
      const next = KEYS[name];
      if (localStorage.getItem(next) == null && localStorage.getItem(oldKey) != null) {
        localStorage.setItem(next, localStorage.getItem(oldKey));
      }
    }
    localStorage.setItem("safar.migrated", "1");
  } catch {
    /* ignore */
  }
}

migrateLegacy();

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getProfile() {
  return read(KEYS.profile, {
    name: "",
    homeCity: "",
    currency: "INR",
    nationality: "India",
  });
}

export function saveProfile(profile) {
  write(KEYS.profile, profile);
}

export function isOnboarded() {
  return localStorage.getItem(KEYS.onboarded) === "1";
}

export function setOnboarded() {
  localStorage.setItem(KEYS.onboarded, "1");
}

export function clearOnboarded() {
  try {
    localStorage.removeItem(KEYS.onboarded);
  } catch {
    /* ignore */
  }
}

export function getTrips() {
  return read(KEYS.trips, []);
}

export function saveTrip(trip) {
  const trips = getTrips();
  const next = [trip, ...trips.filter((t) => t.id !== trip.id)].slice(0, 40);
  write(KEYS.trips, next);
  return next;
}

export function deleteTrip(id) {
  const next = getTrips().filter((t) => t.id !== id);
  write(KEYS.trips, next);
  return next;
}

export function getChats() {
  return read(KEYS.chats, []);
}

export function saveChat(chat) {
  const chats = getChats();
  const next = [chat, ...chats.filter((c) => c.id !== chat.id)].slice(0, 24);
  write(KEYS.chats, next);
  return next;
}

export function deleteChat(id) {
  const next = getChats().filter((c) => c.id !== id);
  write(KEYS.chats, next);
  return next;
}

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function getVisitorId() {
  try {
    const existing = localStorage.getItem(KEYS.visitor);
    if (existing) return existing;
    const id = uid();
    localStorage.setItem(KEYS.visitor, id);
    return id;
  } catch {
    return "";
  }
}

export function getAuthToken() {
  try {
    return localStorage.getItem(KEYS.token) || "";
  } catch {
    return "";
  }
}

export function getAccount() {
  return read(KEYS.account, null);
}

export function saveSession({ token, user }) {
  if (token) localStorage.setItem(KEYS.token, token);
  write(KEYS.account, {
    email: user?.email || "",
    name: user?.name || "",
    picture: user?.picture || "",
    isAdmin: Boolean(user?.isAdmin),
  });
}

export function clearSession() {
  try {
    localStorage.removeItem(KEYS.token);
    localStorage.removeItem(KEYS.account);
  } catch {
    /* ignore */
  }
}

export function resetLocalUser() {
  clearSession();
  clearOnboarded();
  write(KEYS.profile, { name: "", homeCity: "", currency: "INR", nationality: "India" });
  write(KEYS.chats, []);
  write(KEYS.trips, []);
}

export function replaceChats(chats) {
  write(KEYS.chats, Array.isArray(chats) ? chats.slice(0, 24) : []);
  return getChats();
}

export function replaceTrips(trips) {
  write(KEYS.trips, Array.isArray(trips) ? trips.slice(0, 40) : []);
  return getTrips();
}
