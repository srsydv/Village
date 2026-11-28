import { ajioSearchUrl, amazonSearchUrl } from "./links.js";

const FASHION = /\b(shirts?|t-?shirts?|jeans|denims?|dresses?|sarees?|saris?|kurtas?|kurtis?|lehengas?|shoes|sneakers?|sandals?|heels|footwear|jackets?|hoodies?|trousers|pants|shorts|skirts?|tops|blouses?|sunglasses|belts?|wallets?|handbags?|dupattas?|leggings|sherwanis?|palazzos?|jewellery|jewelry|lipsticks?|perfumes?|makeup|ethnic)\b/i;
const GEAR = /\b(bags?|luggage|suitcases?|cabin bags?|backpacks?|duffels?|adapters?|power banks?|chargers?|earphones|headphones|phones?|mobiles?|laptops?|tablets?|cameras?|umbrellas?|neck pillows?|padlocks?|toiletries|books?|kindles?|water bottles?|bottles?|tripods?|speakers?|trimmers?|memory cards?)\b/i;
const BUYING = /\b(buy|order|purchase|shop|looking for|show me|get me)\b/i;

function tidyProductWords(text) {
  return String(text || "")
    .replace(/\bsleves?\b/gi, "sleeve")
    .replace(/\bfullsleeve\b/gi, "full sleeve")
    .replace(/\bhalfsleeve\b/gi, "half sleeve")
    .replace(/\btshirts?\b/gi, "t-shirt")
    .replace(/\bcoton\b/gi, "cotton");
}

function shopQuery(text) {
  return tidyProductWords(String(text || ""))
    .replace(/^(?:please\s+)?(?:can you\s+)?(?:(?:i want to|i need to|i need|i want|need|give me|get me)\s+)?(?:(?:buy|order|shop for|shop|purchase|show me|get me|give me|looking for|find me)\s+)?/i, "")
    .replace(/^(?:a|an|some|the)\s+/i, "")
    .replace(/\b(on|from)\s+(amazon|ajio)\b/gi, "")
    .replace(/\bfor\s+(me|him|her|us)\b/gi, "")
    .replace(/[?.!]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function shopKind(text) {
  if (/\b(t-?shirts?|tees?)\b/i.test(text)) return "tee";
  if (/\b(shoes|sneakers?|sandals?|heels|footwear)\b/i.test(text)) return "shoes";
  if (/\b(bags?|luggage|suitcases?|cabin bags?|backpacks?|duffels?|trolleys?)\b/i.test(text) && !/\bhandbags?\b/i.test(text)) return "bag";
  if (/\b(phones?|mobiles?|laptops?|tablets?)\b/i.test(text)) return "device";
  if (FASHION.test(text)) return "clothes";
  return "general";
}

export function shopBrief(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 180) return null;
  const fashion = FASHION.test(text);
  const gear = GEAR.test(text);
  const buying = BUYING.test(text);
  if (readOffer(text) && !fashion && !gear) return null;
  if (!fashion && !gear && !buying) return null;
  const query = shopQuery(text);
  if (query.length < 2) return null;
  const kind = shopKind(text);
  return {
    query,
    kind,
    fashion: fashion || kind === "tee" || kind === "clothes" || kind === "shoes",
    amazon: !(/\bajio\b/i.test(text) && !/\bamazon\b/i.test(text)),
    ajio: (fashion || kind === "tee" || kind === "clothes" || kind === "shoes" || /\bajio\b/i.test(text)) && !(/\bamazon\b/i.test(text) && !fashion && !/\bajio\b/i.test(text)),
  };
}

export function replySteps(raw) {
  if (shopBrief(raw)) return ["Preparing your question", "Getting the choices ready", "Writing the reply"];
  if (readOffer(raw)) return ["Reading the trip", "Checking the route", "Writing the reply"];
  return ["Reading your question", "Thinking it through", "Writing the reply"];
}

export const PRODUCT_SEARCH_STEPS = ["Searching the products", "Comparing ratings", "Picking the best ones"];

export function productSteps(raw) {
  const brief = shopBrief(raw);
  if (!brief) return [];
  if (brief.kind === "tee") {
    return [
      { id: "size", prompt: "What size?", options: ["S", "M", "L", "XL", "XXL"] },
      { id: "style", prompt: "Which style?", options: ["Plain crew neck", "V-neck", "Polo", "Graphic"] },
      { id: "budget", prompt: "Budget per tee?", options: ["Under ₹500", "₹500–1,000", "₹1,000–2,000", "Above ₹2,000"] },
    ];
  }
  if (brief.kind === "shoes") {
    return [
      { id: "size", prompt: "What size?", options: ["6", "7", "8", "9", "10", "11"] },
      { id: "budget", prompt: "Budget?", options: ["Under ₹1,000", "₹1,000–2,500", "₹2,500–5,000", "Above ₹5,000"] },
    ];
  }
  if (brief.kind === "bag") {
    return [
      { id: "style", prompt: "What type of bag?", options: ["Everyday backpack", "Duffel", "Trolley suitcase", "Sling"] },
      { id: "budget", prompt: "What is your budget?", options: ["Under ₹1,500", "₹1,500–3,000", "₹3,000–6,000", "Above ₹6,000"] },
      { id: "feature", prompt: "Any feature?", options: ["No preference", "Laptop sleeve", "Waterproof", "Cabin size"] },
    ];
  }
  if (brief.kind === "clothes") {
    return [
      { id: "size", prompt: "What size?", options: ["S", "M", "L", "XL", "XXL"] },
      { id: "budget", prompt: "Budget?", options: ["Under ₹1,000", "₹1,000–2,000", "₹2,000–4,000", "Above ₹4,000"] },
    ];
  }
  if (brief.kind === "device") {
    return [{ id: "budget", prompt: "Budget?", options: ["Under ₹15,000", "₹15,000–30,000", "₹30,000–60,000", "Above ₹60,000"] }];
  }
  return [{ id: "budget", prompt: "Budget?", options: ["Under ₹500", "₹500–2,000", "₹2,000–5,000", "Above ₹5,000"] }];
}

export function productPicks(raw, answers = {}) {
  const brief = shopBrief(raw);
  if (!brief) return { summary: "", picks: [] };
  const size = answers.size ? `size ${answers.size}` : "";
  const style = answers.style && !new RegExp(answers.style.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(brief.query) ? answers.style : "";
  const feature = answers.feature && answers.feature !== "No preference" ? answers.feature : "";
  const note = String(answers.note || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const budget = answers.budget || "";
  const query = [brief.query, style, size, feature, note].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const summary = `Best rated ${[brief.query, style, size, feature, note, budget].filter(Boolean).join(", ")}.`;
  return {
    summary,
    query,
    budget,
    searchHref: amazonSearchUrl(query),
  };
}

export function readShop(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 180) return [];
  const fashion = FASHION.test(text);
  const gear = GEAR.test(text);
  const buying = BUYING.test(text);
  if (readOffer(text) && !fashion && !gear) return [];
  if (!fashion && !gear && !buying) return [];
  const query = shopQuery(text);
  if (query.length < 2) return [];
  const namedAmazon = /\bamazon\b/i.test(text);
  const namedAjio = /\bajio\b/i.test(text);
  const links = [];
  if ((fashion || namedAjio) && !(namedAmazon && !namedAjio && !fashion)) {
    links.push({
      id: "ajio",
      name: "Ajio",
      href: ajioSearchUrl(query),
      detail: query,
      action: "See on Ajio",
    });
  }
  if ((gear || buying || fashion || namedAmazon) && !(namedAjio && !namedAmazon && !gear && !fashion)) {
    links.push({
      id: "amazon",
      name: "Amazon",
      href: amazonSearchUrl(query),
      detail: query,
      action: "See on Amazon",
    });
  }
  return links;
}

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
  const filler = /^(?:please|show|find|get|need|want|book|booking|cheap|cheapest|best|direct|nonstop|a|an|the|me|my|our|ticket|tickets|flight|flights|fly|flying|train|trains|bus|buses)$/i;
  const tidy = (value) => {
    const words = String(value || "")
      .replace(/\b(for|with|on|this|next|tomorrow|tonight|please|around|about)\b.*$/i, "")
      .replace(/[?.!,].*$/, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    while (words.length > 1 && filler.test(words[0])) words.shift();
    return words.join(" ");
  };

  const modes = [];
  if (/\b(flight|flights|fly|flying|plane|airline|airlines)\b/.test(lower)) modes.push("flight");
  if (/\b(train|trains|rail|railway)\b/.test(lower)) modes.push("train");
  if (/\b(bus|buses|coach)\b/.test(lower)) modes.push("bus");

  let from = "";
  let to = "";
  const route =
    text.match(/\bfrom\s+([A-Za-z][A-Za-z .'-]{1,40}?)\s+to\s+([A-Za-z][A-Za-z .'-]{1,40})/i) ||
    (modes.length
      ? text.match(/\b([A-Za-z][A-Za-z .'-]{1,40}?)\s+to\s+([A-Za-z][A-Za-z .'-]{1,40})/i)
      : null);
  if (route) {
    from = tidy(route[1]);
    to = tidy(route[2]).replace(/\b(flight|flights|fly|flying|plane|airline|airlines|train|trains|rail|railway|bus|buses|coach)\b/gi, "").trim();
  }
  if (from && to && !modes.length) modes.push("flight", "train", "bus");

  const inCity = text.match(/\bin\s+([A-Za-z][A-Za-z .'-]{1,40})/i);
  const city = inCity ? tidy(inCity[1]) : "";
  const stayHit = /\b(hotel|hotels|stay|stays|hostel|guesthouse|resort)\b/.test(lower);
  const stayNearby = stayHit && /\b(near\s*by(?:\s+me)?|nearby(?:\s+me)?|near me|around me|around here|close to me|close by)\b/.test(lower);
  const foodHit = /\b(eat|food|restaurant|restaurants|dinner|lunch|breakfast|cafe)\b/.test(lower);
  const sightHit = /\b(temple|temples|sight|sights|things to do|what to do|visit)\b/.test(lower);
  const stayCity = stayHit && !stayNearby ? city || to : "";
  const placeCity = foodHit || sightHit ? city || to : "";
  if (!((from && to && modes.length) || stayCity || stayNearby || placeCity)) return null;

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
    stayNearby,
    stayIds,
    foodCity: foodHit ? placeCity : "",
    sightCity: sightHit ? placeCity : "",
  };
}

const STAY_WORD = /\b(hotels?|stays?|rooms?|hostels?|guesthouses?|resorts?|accommodations?|lodging)\b/i;
const STAY_TYPO = /\b(hotals|hotal|hotles|hotle|hotls|hotl|hotell|htels|htel|hote)\b/gi;
const NEARBY_WORD = /\b(near\s*by(?:\s+me)?|nearby(?:\s+me)?|near me|around me|around here|close to me|close by)\b/i;

function tidyPlace(value) {
  return String(value || "")
    .replace(/\b(for|with|on|this|next|tomorrow|tonight|please|around|about)\b.*$/i, "")
    .replace(/[?.!,].*$/, "")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !/^(a|an|the|please|show|find|book|cheap|best|me)$/i.test(word))
    .join(" ")
    .slice(0, 40);
}

export function stayAsk(raw) {
  const text = String(raw || "")
    .replace(STAY_TYPO, (word) => (/s$/i.test(word) ? "hotels" : "hotel"))
    .replace(/\s+/g, " ")
    .trim();
  if (!text || !STAY_WORD.test(text)) return null;
  const nearby = NEARBY_WORD.test(text);
  if (nearby) return { city: "", nearby: true };
  const named = text.match(/\b(?:in|at)\s+([A-Za-z][A-Za-z .'-]{1,40})/i);
  const lead = text.match(/^([A-Za-z][A-Za-z .'-]{1,40}?)\s+(?:hotels?|stays?|rooms?|hostels?|resorts?)\b/i);
  return { city: tidyPlace(named?.[1] || lead?.[1] || ""), nearby: false };
}

export function stayReply(raw) {
  const stay = stayAsk(raw);
  if (!stay) return "";
  if (stay.nearby) return "Allow location, then enter how far, the dates, how many people, and your budget.";
  return "Enter the dates, how many people, and your budget.";
}

export function stayNote(content) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  return /^(use the stay box|enter the dates, how many people|allow location, then enter how far)/i.test(text);
}

export function shownReply(question, content) {
  if (stayAsk(question) || stayNote(content)) return "";
  return content;
}
