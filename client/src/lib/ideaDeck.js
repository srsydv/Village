import { DESTINATIONS } from "./destinations.js";
import { placeKey, placeTitle } from "./placeHistory.js";

function destinationCard(place, currency) {
  const price = currency === "INR" && place.from ? `from ${place.from}` : place.season || "";
  return {
    id: place.id,
    name: place.name,
    country: place.country,
    image: place.image || "",
    planLabel: `${place.name}, ${place.country}`,
    detail: [place.country, place.vibe, price].filter(Boolean).join(" · "),
    meta: place.country,
  };
}

function historyCard(place, currency) {
  const known = DESTINATIONS.find((item) => placeKey(item.name) === placeKey(place.name));
  if (known) return destinationCard(known, currency);
  return {
    id: `history-${placeKey(place.name)}`,
    name: place.name,
    country: place.country || "",
    image: place.image || "",
    planLabel: place.label || (place.country ? `${place.name}, ${place.country}` : place.name),
    detail: [place.country, "You looked this up"].filter(Boolean).join(" · "),
    meta: place.country || "Your plan",
  };
}

function nearbyCard(place, fromLabel) {
  const km = place.distanceKm ? `${Math.round(place.distanceKm)} km` : "";
  const from = fromLabel && km ? `${km} from ${fromLabel}` : km;
  return {
    id: place.id || `near-${placeKey(place.name)}`,
    name: place.name,
    country: place.country || "",
    image: place.image || "",
    planLabel: place.country ? `${place.name}, ${place.country}` : place.name,
    detail: [place.state || place.country, from].filter(Boolean).join(" · "),
    meta: km || place.country || "",
  };
}

function stampImage(place, origin) {
  if (!place || place.image) return place;
  if (origin?.image && placeKey(origin.name) === placeKey(place.name)) {
    return { ...place, image: origin.image };
  }
  return place;
}

function rotate(list, seed) {
  if (!list.length) return [];
  const start = Math.abs(seed) % list.length;
  return [...list.slice(start), ...list.slice(0, start)];
}

function foreignPicks(count, used, homeCountry, now) {
  if (count <= 0) return [];
  const home = placeKey(homeCountry) || "india";
  const list = DESTINATIONS.filter((place) => placeKey(place.country) !== home && !used.has(placeKey(place.name)));
  return rotate(list, now.getDate()).slice(0, count);
}

function starterCards(currency, now) {
  return rotate(DESTINATIONS, now.getDate()).slice(0, 6).map((place) => destinationCard(place, currency));
}

export function buildIdeaDeck({
  history = [],
  nearby = [],
  homeCity = "",
  homeCountry = "",
  currency = "INR",
  origin = null,
  now = new Date(),
  fill = true,
} = {}) {
  const used = new Set();
  const home = placeKey(homeCity);
  if (home) used.add(home);
  const cards = [];
  const add = (card) => {
    const key = placeKey(card?.name);
    if (!key || used.has(key)) return;
    used.add(key);
    cards.push(card);
  };

  const anchorName = history[0]?.name || "";
  const fromLabel = history.length ? anchorName : placeTitle(homeCity);

  if (history.length) {
    add(historyCard(stampImage(history[0], origin), currency));
    nearby.slice(0, 3).forEach((place) => add(nearbyCard(place, fromLabel)));
    history.slice(1, 3).forEach((place) => add(historyCard(stampImage(place, origin), currency)));
    if (fill) {
      foreignPicks(6 - cards.length, used, homeCountry || origin?.country || "", now).forEach((place) =>
        add(destinationCard(place, currency)),
      );
    }
    return {
      source: "history",
      kicker: "From your plans",
      place: fromLabel,
      cards: cards.slice(0, 6),
      loading: false,
    };
  }

  if (home && nearby.length) {
    nearby.slice(0, 4).forEach((place) => add(nearbyCard(place, fromLabel)));
    foreignPicks(6 - cards.length, used, homeCountry || origin?.country || "", now).forEach((place) =>
      add(destinationCard(place, currency)),
    );
    return {
      source: "nearby",
      kicker: `Near ${fromLabel}`,
      place: fromLabel,
      cards: cards.slice(0, 6),
      loading: false,
    };
  }

  return {
    source: "starter",
    kicker: "Idea if you are stuck",
    place: "",
    cards: starterCards(currency, now),
    loading: false,
  };
}
