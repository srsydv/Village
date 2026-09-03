const KEYS = {
  profile: "aurea.profile",
  trips: "aurea.trips",
  chats: "aurea.chats",
  onboarded: "aurea.onboarded",
};

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

export function uid() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
