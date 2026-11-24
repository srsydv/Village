export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.safartravel.app";

export const STAY_PARTNERS = [
  {
    id: "makemytrip",
    name: "MakeMyTrip",
    href: "https://track.vcommission.com/click?campaign_id=10156&pub_id=133956",
  },
  {
    id: "goibibo",
    name: "Goibibo",
    href: "https://track.vcommission.com/click?campaign_id=10099&pub_id=133956",
  },
];

const AMAZON_TAG = "safartravel-21";
const AJIO_TRACKING = "https://track.vcommission.com/click?campaign_id=10364&pub_id=133956";

export function amazonSearchUrl(query) {
  const url = new URL("https://www.amazon.in/s");
  url.searchParams.set("k", String(query || "").trim());
  url.searchParams.set("tag", AMAZON_TAG);
  return url.toString();
}

export function ajioSearchUrl(query) {
  const destination = new URL("https://www.ajio.com/search/");
  destination.searchParams.set("text", String(query || "").trim());
  const tracked = new URL(AJIO_TRACKING);
  tracked.searchParams.set("url", destination.toString());
  return tracked.toString();
}

export function trackPartner(id, destination = "") {
  const partner = STAY_PARTNERS.find((item) => item.id === id);
  if (!partner) return destination;
  if (!destination) return partner.href;
  const tracked = new URL(partner.href);
  tracked.searchParams.set("url", destination);
  return tracked.toString();
}

export function placeLinks(place, city = "") {
  const where = `${place?.name || ""} ${city || place?.city || ""}`.trim();
  const q = encodeURIComponent(where);
  const geo =
    place?.lat && place?.lon
      ? encodeURIComponent(`${place.lat},${place.lon}`)
      : q;
  return {
    maps: `https://www.google.com/maps/search/?api=1&query=${geo}`,
    booking: `https://www.booking.com/searchresults.html?ss=${q}`,
    makemytrip: STAY_PARTNERS[0].href,
    goibibo: STAY_PARTNERS[1].href,
    airbnb: `https://www.airbnb.com/s/${encodeURIComponent(city || place?.city || place?.name || "")}/homes`,
    zomato: `https://www.zomato.com/search?q=${q}`,
    website: place?.website || "",
  };
}

export function emptyPicks() {
  return { stay: null, food: [], sights: [] };
}

export function pickCount(picks) {
  return (picks?.stay ? 1 : 0) + (picks?.food?.length || 0) + (picks?.sights?.length || 0);
}

export function togglePick(picks, place) {
  const next = {
    stay: picks.stay || null,
    food: [...(picks.food || [])],
    sights: [...(picks.sights || [])],
  };
  if (place.kind === "stay") {
    next.stay = next.stay?.id === place.id ? null : place;
    return next;
  }
  const key = place.kind === "food" ? "food" : "sights";
  const max = key === "food" ? 5 : 6;
  const exists = next[key].some((p) => p.id === place.id);
  next[key] = exists ? next[key].filter((p) => p.id !== place.id) : [...next[key], place].slice(0, max);
  return next;
}

export function isPicked(picks, place) {
  if (!place) return false;
  if (place.kind === "stay") return picks.stay?.id === place.id;
  const list = place.kind === "food" ? picks.food : picks.sights;
  return Boolean(list?.some((p) => p.id === place.id));
}
