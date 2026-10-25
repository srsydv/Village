import { normalizeStyle, styleGuide } from "../../client/src/lib/styleBudget.js";

const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "this", "that", "trip", "tour", "visit",
  "your", "have", "about", "around", "where", "when", "what", "make", "need", "days",
  "day", "please", "include", "want", "like", "some", "very", "really", "also", "just",
  "kind", "thing", "things", "near", "over", "under", "than", "then", "them", "they",
]);

export const DAYS_SYSTEM = `Return ONLY valid JSON. No markdown.
{ "days": [{ "title": "string", "morning": "string", "afternoon": "string", "evening": "string", "food": "string" }] }
Write exactly the number of days requested. Name real places for that destination. Two or three sentences in each part. Match the travel style. Follow the traveler's comment. Do not copy the current outline.`;

export const GAP_SYSTEM = `You fill only the missing pieces of a trip that is already written.
Return ONLY valid JSON. No markdown.
Schema:
{
  "slots": [{ "day": 1, "morning": "", "afternoon": "", "evening": "", "food": "" }],
  "extraDays": [{ "title": "", "morning": "", "afternoon": "", "evening": "", "food": "" }],
  "tips": ["string"],
  "food": ["string"],
  "rides": [{ "mode": "flight|train|bus", "service": "", "duration": "", "typicalFare": "", "fareLow": 0, "why": "" }],
  "flightPicks": [{ "airline": "", "via": "", "stops": 0, "duration": "", "typicalFare": "", "fareLow": 0, "why": "" }],
  "visa": ""
}
Omit any key you were not asked for. Do not rewrite topics already in the outline. Name real places. Two sentences per slot. Match the travel style. Costs are estimates in the traveler's currency.`;

export function placeKey(value) {
  return foldText(value)
    .split(",")[0]
    .replace(/\b(city|town|district)\b/g, "")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sameCityName(a, b) {
  const x = placeKey(a);
  const y = placeKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  if (shorter.length >= 4 && longer.split(" ").includes(shorter)) return true;
  return x.length >= 6 && y.length >= 6 && Math.abs(x.length - y.length) <= 1 && editDistance(x, y) <= 1;
}

export function interestPhrases(value) {
  return String(value || "")
    .split(/[,;&\n+/]| and /i)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 1 && tokens(part).length > 0);
}

export function composeFromLibrary(input = {}, docs = []) {
  const cityDocs = (Array.isArray(docs) ? docs : []).filter(
    (doc) => doc?.plan && Array.isArray(doc.plan.days) && doc.plan.days.length && sameTripPlace(doc, input),
  );
  if (!cityDocs.length) return { mode: "full", locked: [] };

  const phrases = uniquePhrases([...interestPhrases(input.interests), ...interestPhrases(input.notes)]);
  const style = normalizeStyle(input.style);
  const sameStyle = cityDocs.filter((doc) => normalizeStyle(doc.style) === style);
  const locked = lockExcerpts(cityDocs, phrases);

  const notes = String(input.notes || "").trim();
  if (!sameStyle.length || notes.length > 280) {
    return { mode: "full", locked };
  }

  const ranked = [...sameStyle].sort((a, b) => scoreDoc(b, input, phrases) - scoreDoc(a, input, phrases));
  const base = ranked[0];
  const draft = stampTrip(clone(base.plan), input, base);
  const wanted = wantedDays(input, draft.days.length);
  const covered = [];
  const missing = [];

  for (const phrase of phrases) {
    if (planCovers(draft, phrase)) {
      covered.push(phrase);
      continue;
    }
    const found = findDay(sameStyle, phrase) || findDay(cityDocs, phrase);
    if (!found) {
      missing.push(phrase);
      continue;
    }
    if (!draft.days.some((day) => similarDay(day, found))) draft.days.push(clone(found));
    if (planCovers(draft, phrase)) covered.push(phrase);
    else missing.push(phrase);
  }

  draft.days = fitDays(draft.days, Math.min(wanted, draft.days.length), phrases);
  const extraDays = Math.max(0, wanted - draft.days.length);
  const transport = takeTransport(cityDocs, input);
  if (transport) {
    draft.rides = transport.rides;
    if (transport.flightPicks) draft.flightPicks = transport.flightPicks;
    else delete draft.flightPicks;
  } else if (modeList(input.modes).length) {
    draft.rides = [];
    delete draft.flightPicks;
  } else {
    draft.rides = [];
    draft.flightPicks = [];
  }

  const visaGap = applyVisa(draft, cityDocs, input, base);
  const gaps = [];
  if (missing.length) gaps.push({ type: "interests", items: missing });
  if (extraDays) gaps.push({ type: "days", count: extraDays });
  if (!transport && modeList(input.modes).length) gaps.push({ type: "transport", modes: modeList(input.modes) });
  if (visaGap) gaps.push({ type: "visa" });

  if (!gaps.length) return { mode: "ready", plan: draft, locked };

  return {
    mode: "gaps",
    plan: draft,
    gaps,
    protected: covered,
    phrases,
    days: wanted,
    brief: gapBrief(input, draft, gaps),
    system: GAP_SYSTEM,
    locked,
  };
}

export function mergeGap(composed, patch) {
  if (!composed?.plan || !patch || typeof patch !== "object") return null;
  const next = clone(composed.plan);
  const protectedPhrases = composed.protected || [];
  let placed = false;

  for (const slot of Array.isArray(patch.slots) ? patch.slots : []) {
    if (placeSlot(next.days, slot, protectedPhrases)) placed = true;
  }
  for (const extra of Array.isArray(patch.extraDays) ? patch.extraDays : []) {
    if (!extra || typeof extra !== "object") continue;
    const day = {
      title: String(extra.title || "Another day").trim(),
      morning: String(extra.morning || "").trim(),
      afternoon: String(extra.afternoon || "").trim(),
      evening: String(extra.evening || "").trim(),
      food: String(extra.food || "").trim(),
    };
    if (!day.morning && !day.afternoon && !day.evening) continue;
    next.days.push(day);
    placed = true;
  }
  if (Array.isArray(patch.tips) && patch.tips.length) {
    next.tips = uniqueLines([...(next.tips || []), ...patch.tips.map((item) => String(item || "").trim())]);
    placed = true;
  }
  if (Array.isArray(patch.food) && patch.food.length) {
    next.food = uniqueLines([...(next.food || []), ...patch.food.map((item) => String(item || "").trim())]);
    placed = true;
  }
  if (Array.isArray(patch.rides) && patch.rides.length) {
    next.rides = patch.rides.slice(0, 4);
    placed = true;
  }
  if (Array.isArray(patch.flightPicks) && patch.flightPicks.length) {
    next.flightPicks = patch.flightPicks.slice(0, 3);
    placed = true;
  }
  if (typeof patch.visa === "string" && patch.visa.trim()) {
    next.visa = patch.visa.trim();
    placed = true;
  }
  if (!placed) return null;

  const phrases = composed.phrases || [];
  const count = composed.days || next.days.length;
  next.days = fitDays(next.days, count, phrases);
  return next.days.length ? next : null;
}

export function refreshDaysFromLibrary(input = {}, docs = [], currentDays = []) {
  const count = wantedDays({ days: input.days || currentDays.length }, currentDays.length || 1);
  const phrases = uniquePhrases(interestPhrases(input.comment));
  const cityDocs = (Array.isArray(docs) ? docs : []).filter(
    (doc) => doc?.plan && Array.isArray(doc.plan.days) && doc.plan.days.length && sameTripPlace(doc, input),
  );
  const current = Array.isArray(currentDays) ? currentDays.filter(Boolean) : [];

  if (!phrases.length) {
    for (const doc of cityDocs) {
      const fitted = fitDays(doc.plan.days.map((day) => clone(day)), count, []);
      if (fitted.length && !sameOutline(fitted, current)) return { mode: "ready", days: fitted };
    }
    return { mode: "write", brief: daysBrief(input, count, current, ""), system: DAYS_SYSTEM };
  }

  const picked = [];
  const missing = [];
  for (const phrase of phrases) {
    const found = findDay(cityDocs, phrase);
    if (!found) {
      missing.push(phrase);
      continue;
    }
    if (!picked.some((day) => similarDay(day, found))) picked.push(found);
  }
  for (const doc of cityDocs) {
    for (const day of doc.plan.days) {
      if (picked.length >= count) break;
      if (picked.some((item) => similarDay(item, day))) continue;
      picked.push(clone(day));
    }
  }

  const draft = fitDays(picked, Math.min(count, Math.max(picked.length, 1)), phrases);
  const stillMissing = phrases.filter((phrase) => !draft.some((day) => textCoversPhrase(dayBlob(day), phrase)));
  const ready = fitDays(picked, count, phrases);
  if (!stillMissing.length && ready.length >= count && !sameOutline(ready, current)) {
    return { mode: "ready", days: ready };
  }
  if (!picked.length) {
    return { mode: "write", brief: daysBrief(input, count, current, phrases.join("; ")), system: DAYS_SYSTEM };
  }

  const gaps = [];
  if (stillMissing.length) gaps.push({ type: "interests", items: stillMissing });
  if (draft.length < count) gaps.push({ type: "days", count: count - draft.length });
  if (!gaps.length) {
    return { mode: "write", brief: daysBrief(input, count, current, phrases.join("; ")), system: DAYS_SYSTEM };
  }
  return {
    mode: "gaps",
    plan: { days: draft, destination: input.destination },
    protected: phrases.filter((phrase) => !stillMissing.includes(phrase)),
    phrases,
    days: count,
    brief: gapBrief({ ...input, budget: input.budget }, { days: draft, destination: input.destination }, gaps),
    system: GAP_SYSTEM,
  };
}

export function daysFromPatch(patch) {
  const list = Array.isArray(patch?.days) ? patch.days : [];
  return list
    .map((day, index) => ({
      day: index + 1,
      title: String(day?.title || `Day ${index + 1}`).trim(),
      morning: String(day?.morning || "").trim(),
      afternoon: String(day?.afternoon || "").trim(),
      evening: String(day?.evening || "").trim(),
      food: String(day?.food || "").trim(),
    }))
    .filter((day) => day.title || day.morning || day.afternoon || day.evening);
}

function daysBrief(input, count, current, comment) {
  const profile = input.profile || {};
  const outline = current
    .map((day, index) => `Day ${index + 1}: ${dayBlob(day).slice(0, 180)}`)
    .join("\n");
  return [
    `Write ${count} days for ${String(input.destination || "").trim()}.`,
    input.country && `Country: ${input.country}`,
    input.travelers && `Travelers: ${input.travelers}`,
    `Currency: ${profile.currency || "INR"}`,
    styleGuide(input.style),
    input.budget && `Budget ceiling: ${input.budget}.`,
    (input.origin || profile.homeCity) && `Departing from: ${input.origin || profile.homeCity}`,
    comment && `The traveler wants the days to include: ${comment}.`,
    outline && `Current days. Write a different plan. Do not copy this outline:\n${outline}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function sameOutline(next, current) {
  const pack = (days) => (days || []).map((day) => dayBlob(day).replace(/\s+/g, " ").trim().toLowerCase()).join("\n");
  return pack(next) === pack(current);
}

export function lockedBrief(locked) {
  if (!Array.isArray(locked) || !locked.length) return "";
  return locked
    .map(
      (item) =>
        `This part is already written for "${item.phrase}". Use this wording somewhere in the matching day. Do not invent a different version of it:\n${item.text}`,
    )
    .join("\n\n");
}

function sameTripPlace(doc, input) {
  const city = sameCityName(doc.destination, input.destination) || sameCityName(doc.plan?.destination, input.destination);
  if (!city) return false;
  const stored = norm(doc.country || doc.plan?.country);
  const asked = norm(input.country);
  if (!stored || !asked) return true;
  return stored.includes(asked) || asked.includes(stored);
}

function scoreDoc(doc, input, phrases) {
  let score = 0;
  if (sameCityName(doc.origin, input.origin || input.profile?.homeCity)) score += 3;
  const blob = `${doc.interests || ""} ${planBlob(doc.plan)}`;
  for (const phrase of phrases) {
    if (textCoversPhrase(blob, phrase)) score += 4;
  }
  const want = wantedDays(input, doc.plan.days.length);
  score += Math.max(0, 3 - Math.abs(want - doc.plan.days.length));
  if (norm(doc.nationality) && norm(doc.nationality) === norm(input.profile?.nationality)) score += 1;
  const askedModes = modeList(input.modes);
  if (askedModes.length && sameList(doc.modes, askedModes)) score += 2;
  return score;
}

function stampTrip(plan, input, source) {
  const next = plan;
  next.destination = String(input.destination || next.destination || "").trim();
  next.country = String(input.country || next.country || "").trim();
  next.style = normalizeStyle(input.style);
  next.hotels = [];
  if (input.startDate) next.startDate = String(input.startDate);
  if (input.endDate) next.endDate = String(input.endDate);
  if (input.travelers) next.travelers = String(input.travelers);
  const days = wantedDays(input, next.days?.length || 1);
  next.daysCount = days;
  next.summary = loosenCopy(next.summary, source, input);
  next.days = (next.days || []).map((day) => ({
    ...day,
    title: loosenCopy(day.title, source, input),
    morning: loosenCopy(day.morning, source, input),
    afternoon: loosenCopy(day.afternoon, source, input),
    evening: loosenCopy(day.evening, source, input),
    food: loosenCopy(day.food, source, input),
  }));
  return next;
}

function loosenCopy(value, source, input) {
  let text = String(value || "");
  const previousParty = String(source?.travelers || "").trim();
  const nextParty = String(input.travelers || "").trim();
  if (previousParty && nextParty && previousParty.toLowerCase() !== nextParty.toLowerCase()) {
    text = text.replaceAll(previousParty, nextParty);
  }
  const previousBudget = String(source?.budget || "").trim();
  const nextBudget = String(input.budget || "").trim();
  if (!text || !previousBudget || previousBudget.toLowerCase() === nextBudget.toLowerCase()) return text;
  const kept = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !sentence.toLowerCase().includes(previousBudget.toLowerCase()))
    .join(" ")
    .trim();
  return kept || text;
}

function takeTransport(docs, input) {
  const modes = modeList(input.modes);
  if (!modes.length) return { rides: [], flightPicks: [] };
  const origin = input.origin || input.profile?.homeCity;
  const hit = docs.find(
    (doc) =>
      sameCityName(doc.origin, origin) &&
      sameList(doc.modes, modes) &&
      Array.isArray(doc.plan?.rides) &&
      doc.plan.rides.length,
  );
  if (!hit) return null;
  return {
    rides: hit.plan.rides,
    flightPicks: modes.includes("flight") && Array.isArray(hit.plan.flightPicks) ? hit.plan.flightPicks : null,
  };
}

function applyVisa(draft, docs, input, base) {
  const nationality = norm(input.profile?.nationality);
  if (!nationality) return false;
  const hit = docs.find((doc) => norm(doc.nationality) === nationality && doc.plan?.visa);
  if (hit) {
    draft.visa = hit.plan.visa;
    return false;
  }
  if (norm(base.nationality) === nationality && base.plan?.visa) return false;
  draft.visa = "";
  return true;
}

function gapBrief(input, plan, gaps) {
  const profile = input.profile || {};
  const outline = (plan.days || [])
    .map((day, index) => {
      const line = [day.title, day.morning, day.afternoon, day.evening, day.food].filter(Boolean).join(" — ");
      return `Day ${index + 1}: ${line.slice(0, 240)}`;
    })
    .join("\n");
  const lines = [
    `Destination: ${plan.destination || input.destination}`,
    input.country && `Country: ${input.country}`,
    `Travelers: ${input.travelers || "a small group"}`,
    `Currency: ${profile.currency || "INR"}`,
    styleGuide(input.style),
    input.budget && `Budget ceiling: ${input.budget}. Stay inside it.`,
    (input.origin || profile.homeCity) && `Departing from: ${input.origin || profile.homeCity}`,
    "Outline already written. Keep it:",
    outline,
  ];
  for (const gap of gaps) {
    if (gap.type === "interests") {
      lines.push(
        `Missing from the outline: ${gap.items.join("; ")}. Return slots that add only those topics. Put each topic on a day whose matching part does not already cover it. Prefer evening, then afternoon.`,
      );
    }
    if (gap.type === "days") {
      lines.push(`The traveler needs ${gap.count} more day(s). Return that many extraDays. Do not repeat the outline.`);
    }
    if (gap.type === "transport") {
      const flight = gap.modes.includes("flight");
      lines.push(
        `Return rides with one entry for each of: ${gap.modes.join(", ")}. One way, per adult. ${
          flight ? "Also return 1 to 3 flightPicks, lowest fare first." : "Do not return flightPicks."
        }`,
      );
    }
    if (gap.type === "visa") {
      lines.push(
        `Return visa as one short paragraph for a ${profile.nationality} passport visiting ${input.country || input.destination}. The traveler applies themselves.`,
      );
    }
  }
  return lines.filter(Boolean).join("\n");
}

function lockExcerpts(docs, phrases) {
  const locked = [];
  for (const phrase of phrases) {
    const day = findDay(docs, phrase);
    if (!day) continue;
    const text = excerpt(day, phrase);
    if (!text || locked.some((item) => item.phrase === phrase)) continue;
    locked.push({ phrase, text });
  }
  return locked;
}

function excerpt(day, phrase) {
  const fields = ["evening", "afternoon", "morning", "food"].filter((field) => textCoversPhrase(day[field], phrase));
  const chosen = fields.length ? fields : ["title", "morning", "afternoon", "evening", "food"];
  return chosen
    .map((field) => (day[field] ? `${field}: ${day[field]}` : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 700);
}

function findDay(docs, phrase) {
  let best = null;
  let bestScore = 0;
  for (const doc of docs) {
    for (const day of doc.plan?.days || []) {
      const blob = dayBlob(day);
      if (!textCoversPhrase(blob, phrase)) continue;
      const score = tokens(blob).length;
      if (!best || score < bestScore) {
        best = day;
        bestScore = score;
      }
    }
  }
  return best ? clone(best) : null;
}

function planCovers(plan, phrase) {
  return textCoversPhrase(planBlob(plan), phrase);
}

function planBlob(plan) {
  return [
    plan?.summary,
    plan?.bestTime,
    ...(plan?.food || []),
    ...(plan?.tips || []),
    ...(plan?.packing || []),
    ...(plan?.days || []).map(dayBlob),
  ]
    .filter(Boolean)
    .join(" ");
}

function dayBlob(day) {
  return [day?.title, day?.morning, day?.afternoon, day?.evening, day?.food].filter(Boolean).join(" ");
}

function placeSlot(days, slot, protectedPhrases) {
  if (!slot || typeof slot !== "object" || !Array.isArray(days) || !days.length) return false;
  const fields = ["morning", "afternoon", "evening", "food"].filter((field) => String(slot[field] || "").trim());
  if (!fields.length) return false;
  const preferred = Number(slot.day) - 1;
  const order = days.map((_, index) => index);
  if (preferred >= 0 && preferred < days.length) {
    order.splice(order.indexOf(preferred), 1);
    order.unshift(preferred);
  }
  let placed = false;
  const leftovers = {};
  for (const field of fields) {
    const text = String(slot[field]).trim();
    const index = order.find((item) => !protectedPhrases.some((phrase) => textCoversPhrase(days[item][field], phrase)));
    if (index == null) {
      leftovers[field] = text;
      continue;
    }
    days[index][field] = text;
    placed = true;
  }
  if (Object.keys(leftovers).length) {
    days.push({
      title: String(slot.title || "One more stop").trim(),
      morning: leftovers.morning || "",
      afternoon: leftovers.afternoon || "",
      evening: leftovers.evening || "",
      food: leftovers.food || "",
    });
    placed = true;
  }
  return placed;
}

function fitDays(days, count, phrases) {
  const list = (days || []).filter((day) => day && (day.morning || day.afternoon || day.evening || day.title));
  const target = Math.max(1, count || list.length || 1);
  if (list.length <= target) return renumber(list);
  if (target === 1 && phrases.length) {
    const hit = list.find((day) => phrases.some((phrase) => textCoversPhrase(dayBlob(day), phrase)));
    if (hit) return renumber([hit]);
  }
  const pins = [];
  for (const phrase of phrases) {
    const hit = list.find((day) => textCoversPhrase(dayBlob(day), phrase) && !pins.includes(day));
    if (hit) pins.push(hit);
  }
  const arrival = list.find((day) => isArrival(day) && !pins.includes(day));
  const departure = [...list].reverse().find((day) => isDeparture(day) && day !== arrival && !pins.includes(day));
  if (arrival && pins.length < target) pins.push(arrival);
  if (departure && pins.length < target) pins.push(departure);
  for (const day of list) {
    if (pins.length >= target) break;
    if (!pins.includes(day)) pins.push(day);
  }
  const order = new Map(list.map((day, index) => [day, index]));
  pins.sort((a, b) => order.get(a) - order.get(b));
  return renumber(pins.slice(0, target));
}

function renumber(days) {
  return days.map((day, index) => ({ ...day, day: index + 1 }));
}

function isArrival(day) {
  return /\b(arriv\w*|reach|check-?in|settle in)\b/i.test(dayBlob(day));
}

function isDeparture(day) {
  return /\b(depart\w*|fly back|head home|return home|journey home)\b/i.test(dayBlob(day));
}

function similarDay(a, b) {
  const left = tokens(dayBlob(a));
  const right = tokens(dayBlob(b));
  if (!left.length || !right.length) return false;
  const shared = left.filter((token) => right.some((other) => tokenClose(token, other)));
  return shared.length / Math.min(left.length, right.length) >= 0.6;
}

function textCoversPhrase(haystack, phrase) {
  const need = tokens(phrase);
  if (!need.length) return false;
  const have = tokens(haystack);
  if (!have.length) return false;
  if (need.every((token) => have.some((other) => tokenClose(token, other)))) return true;
  return compoundsCover(need, have);
}

function compoundsCover(need, have) {
  const gluedNeed = need.join("");
  if (gluedNeed.length < 5) return false;
  if (have.join("").includes(gluedNeed)) return true;
  if (need.length !== 1) return false;
  for (let i = 0; i < have.length - 1; i += 1) {
    if (tokenClose(need[0], have[i] + have[i + 1])) return true;
  }
  return false;
}

function tokens(value) {
  return foldText(value)
    .split(/[^a-z0-9]+/)
    .map(stem)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

function stem(word) {
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && /(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokenClose(a, b) {
  if (a === b) return true;
  const min = Math.min(a.length, b.length);
  const max = Math.max(a.length, b.length);
  if (min < 5 || max - min > 2) return false;
  return editDistance(a, b) <= (max >= 10 ? 2 : 1);
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function uniquePhrases(list) {
  const seen = new Set();
  const out = [];
  for (const phrase of list) {
    const key = tokens(phrase).join(" ");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
  }
  return out;
}

function uniqueLines(list) {
  const seen = new Set();
  const out = [];
  for (const line of list) {
    const clean = String(line || "").trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function modeList(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((item) => norm(item)).filter(Boolean))].sort();
}

function sameList(a, b) {
  const left = modeList(a);
  const right = modeList(b);
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function wantedDays(input, fallback) {
  const count = Number(input.days);
  if (!Number.isFinite(count) || count < 1) return fallback || 1;
  return Math.min(30, Math.round(count));
}

function foldText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function norm(value) {
  return foldText(value).replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
