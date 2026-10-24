import { useEffect, useMemo, useState } from "react";
import { nearbyPlaces } from "./api.js";
import { buildIdeaDeck } from "./ideaDeck.js";
import { collectHistory, getPlaceHistory, placeKey, placeTitle } from "./placeHistory.js";

const CACHE_KEY = "safar.nearby";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function readNearby(city) {
  const row = readCache()[placeKey(city)];
  if (!row || row.exp < Date.now() || !Array.isArray(row.places) || !row.places.length) return null;
  return { origin: row.origin || null, places: row.places };
}

function writeNearby(city, data) {
  if (!data?.places?.length) return;
  const all = readCache();
  all[placeKey(city)] = {
    exp: Date.now() + WEEK,
    origin: data.origin || null,
    places: data.places,
  };
  const entries = Object.entries(all)
    .sort((a, b) => (b[1]?.exp || 0) - (a[1]?.exp || 0))
    .slice(0, 8);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* ignore quota */
  }
}

export function useIdeaDeck({ profile, trips }) {
  const homeCity = String(profile?.homeCity || "").trim();
  const currency = profile?.currency || "INR";
  const [stored, setStored] = useState(getPlaceHistory);
  const history = useMemo(() => collectHistory(trips, stored, homeCity), [trips, stored, homeCity]);
  const anchor = history[0]?.label || history[0]?.name || homeCity;
  const mode = history.length ? "history" : homeCity ? "nearby" : "starter";
  const anchorKey = placeKey(anchor);
  const [pack, setPack] = useState(() => (mode === "starter" ? null : readNearby(anchor)));
  const [readyKey, setReadyKey] = useState(() => (mode !== "starter" && readNearby(anchor) ? anchorKey : mode === "starter" ? "starter" : ""));

  useEffect(() => {
    const sync = () => setStored(getPlaceHistory());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  useEffect(() => {
    if (mode === "starter" || !anchor) {
      setPack(null);
      setReadyKey("starter");
      return undefined;
    }
    const cached = readNearby(anchor);
    if (cached) {
      setPack(cached);
      setReadyKey(anchorKey);
    } else {
      setPack(null);
      setReadyKey("");
    }
    let cancel = false;
    nearbyPlaces(anchor).then((data) => {
      if (cancel) return;
      if (data?.places?.length) writeNearby(anchor, data);
      setPack(data);
      setReadyKey(anchorKey);
    });
    return () => {
      cancel = true;
    };
  }, [anchor, anchorKey, mode]);

  return useMemo(() => {
    if (mode === "starter") return buildIdeaDeck({ currency });
    const waiting = readyKey !== anchorKey;
    const nearby = !waiting && pack ? pack.places || [] : [];
    const origin = !waiting && pack ? pack.origin : null;
    if (mode === "nearby" && waiting) {
      return {
        source: "nearby",
        kicker: `Near ${placeTitle(homeCity)}`,
        place: placeTitle(homeCity),
        cards: [],
        loading: true,
      };
    }
    if (mode === "nearby" && !nearby.length) return buildIdeaDeck({ currency });
    return buildIdeaDeck({
      history: mode === "history" ? history : [],
      nearby,
      homeCity,
      homeCountry: origin?.country || "",
      currency,
      origin,
      fill: !(mode === "history" && waiting),
    });
  }, [mode, readyKey, anchorKey, pack, history, homeCity, currency]);
}
