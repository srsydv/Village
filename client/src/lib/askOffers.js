export const ASK_IDEAS = [
  [
    { title: "Where to go", prompt: "A quiet weekend from Delhi", icon: "compass" },
    { title: "Find a stay", prompt: "A comfortable hotel in Udaipur for two", icon: "bed" },
    { title: "Things to do", prompt: "What should I eat in Jaipur?", icon: "place" },
    { title: "Getting there", prompt: "Train or flight from Delhi to Varanasi", icon: "ticket" },
  ],
  [
    { title: "Where to go", prompt: "A hill town near Mumbai for the weekend", icon: "compass" },
    { title: "Find a stay", prompt: "A simple stay in Goa for four nights", icon: "bed" },
    { title: "Things to do", prompt: "Temples and food in Madurai", icon: "place" },
    { title: "Getting there", prompt: "Overnight train from Delhi to Lucknow", icon: "ticket" },
  ],
];

export function readOffer(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const tidy = (value) =>
    String(value || "")
      .replace(/\b(for|with|on|this|next|tomorrow|tonight|please|around|about)\b.*$/i, "")
      .replace(/[?.!,].*$/, "")
      .trim();

  const modes = [];
  if (/\b(flight|flights|fly|flying|plane|airline|airlines)\b/.test(lower)) modes.push("flight");
  if (/\b(train|trains|rail|railway)\b/.test(lower)) modes.push("train");
  if (/\b(bus|buses|coach)\b/.test(lower)) modes.push("bus");

  let from = "";
  let to = "";
  const route = text.match(/\bfrom\s+([A-Za-z][A-Za-z .'-]{1,40}?)\s+to\s+([A-Za-z][A-Za-z .'-]{1,40})/i);
  if (route) {
    from = tidy(route[1]);
    to = tidy(route[2]);
  }
  if (from && to && !modes.length) modes.push("flight", "train", "bus");

  const inCity = text.match(/\bin\s+([A-Za-z][A-Za-z .'-]{1,40})/i);
  const city = inCity ? tidy(inCity[1]) : "";
  const stayHit = /\b(hotel|hotels|stay|stays|hostel|guesthouse|resort)\b/.test(lower);
  const foodHit = /\b(eat|food|restaurant|restaurants|dinner|lunch|breakfast|cafe)\b/.test(lower);
  const sightHit = /\b(temple|temples|sight|sights|things to do|what to do|visit)\b/.test(lower);
  const stayCity = stayHit ? city || to : "";
  const placeCity = foodHit || sightHit ? city || to : "";
  if (!((from && to && modes.length) || stayCity || placeCity)) return null;

  const stayIds = [];
  if (stayCity) {
    if (/\b(dorm|hostel)\b/.test(lower)) stayIds.push("dorm");
    if (/\b(guesthouse|simple)\b/.test(lower)) stayIds.push("simple");
    if (/\b(comfortable|3-star|3 star)\b/.test(lower)) stayIds.push("comfortable");
    if (/\b(polished|4-star|4 star)\b/.test(lower)) stayIds.push("polished");
    if (/\b(boutique|refined|5-star|5 star)\b/.test(lower)) stayIds.push("refined");
    if (/\b(villa|resort|exceptional)\b/.test(lower)) stayIds.push("exceptional");
    if (!stayIds.length) stayIds.push("simple", "comfortable", "polished", "refined");
  }

  return {
    from,
    to,
    modes,
    stayCity,
    stayIds,
    foodCity: foodHit ? placeCity : "",
    sightCity: sightHit ? placeCity : "",
  };
}
