import { Router } from "express";
import { logActivity, lastUserText } from "../lib/activity.js";
import { logSearch } from "../lib/searches.js";
import { planSnapshot } from "../lib/snapshot.js";
import {
  DAY_JSON_INSTRUCTIONS,
  PLAN_JSON_INSTRUCTIONS,
  ASK_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  WEEKEND_JSON_INSTRUCTIONS,
  generateTravelReply,
  parsePlanJson,
  streamTravelReply,
} from "../lib/gemini.js";
import { applyStyleBudget, styleGuide } from "../../client/src/lib/styleBudget.js";
import { findGeneratedPlan, listPlansForPlace, planMatchesRequest, saveGeneratedPlan } from "../lib/planCache.js";
import { composeFromLibrary, daysFromPatch, lockedBrief, mergeGap, refreshDaysFromLibrary } from "../lib/planPieces.js";

const router = Router();

function profileLine(profile, { includeName = true } = {}) {
  if (!profile || typeof profile !== "object") return "";
  const bits = [
    includeName && profile.name && `Traveler name: ${profile.name}`,
    profile.homeCity && `Home city: ${profile.homeCity}`,
    profile.currency && `Preferred currency: ${profile.currency}`,
  ].filter(Boolean);
  return bits.length ? `\n\nTraveler profile:\n${bits.join("\n")}` : "";
}

const STAY_LABEL = {
  dorm: "Dorm — a bed in a shared room",
  simple: "Simple private — your own basic room",
  comfortable: "Comfortable — a solid, quiet hotel",
  polished: "Polished — better rooms and a stronger address",
  refined: "Refined — boutique or full service",
  exceptional: "Exceptional — a suite, villa, or leading resort",
};

function recordBuiltPlan(req, plan, model, cached = false) {
  const { destination, country, days, startDate, endDate, travelers, budget, style, interests, notes } = req.body || {};
  const snapshot = planSnapshot(plan);
  const noted = cached ? `saved · ${model || "plan"}` : model;
  logActivity(req, {
    action: "plan",
    query: String(destination || "").trim(),
    ok: true,
    model: noted,
    plan: snapshot,
  });
  logSearch(req, {
    kind: "plan",
    destination,
    country,
    days,
    startDate,
    endDate,
    travelers,
    budget,
    style,
    interests,
    notes,
    ok: true,
    cached,
    model: noted,
    resultTitle: plan?.title || plan?.destination,
    resultDuration: plan?.duration || plan?.daysCount,
    resultBudget: plan?.expenses?.total || plan?.budget?.total,
    resultPlan: snapshot,
  });
}

function stayBrief(stays, style) {
  const chosen = (Array.isArray(stays) ? stays : String(stays || "").split(","))
    .map((id) => STAY_LABEL[String(id || "").trim()])
    .filter(Boolean);
  if (!chosen.length) {
    return "The traveler has not chosen a stay standard. Set hotels to []. Price budget.stay for the travel style above. Do not assume a luxury hotel.";
  }
  return `Stay standards the traveler chose: ${chosen.join("; ")}. Price budget.stay for these. Keep food, local travel, and activities at the ${style || "Balanced"} style. Set hotels to [].`;
}

router.post("/chat", async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-16) : [];
  const profile = req.body?.profile;
  const stream = req.body?.stream !== false;

  if (!messages.length || !messages.some((m) => m.role === "user")) {
    return res.status(400).json({ error: "Type a message first." });
  }

  const system = ASK_SYSTEM_PROMPT + profileLine(profile);

  try {
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const { model, text } = await streamTravelReply({
        messages,
        system,
        onDelta: (delta) => {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        },
      });
      logActivity(req, { action: "ask", query: lastUserText(messages), reply: text, ok: true, model });
      res.write(`data: ${JSON.stringify({ done: true, model })}\n\n`);
      return res.end();
    }

    const { text, model } = await generateTravelReply({ messages, system });
    logActivity(req, { action: "ask", query: lastUserText(messages), reply: text, ok: true, model });
    return res.json({ text, model });
  } catch (err) {
    logActivity(req, {
      action: "ask",
      query: lastUserText(messages),
      ok: false,
      error: err.message,
    });
    const status = err.status || 500;
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: err.message || "Safar could not reply." })}\n\n`);
      return res.end();
    }
    return res.status(status).json({ error: err.message || "Safar could not reply." });
  }
});

router.post("/plan", async (req, res) => {
  const {
    destination,
    country,
    days,
    startDate,
    endDate,
    travelers,
    budget,
    style,
    interests,
    notes,
    origin,
    modes,
    stays,
    profile,
  } = req.body || {};

  if (!destination || !String(destination).trim()) {
    return res.status(400).json({ error: "Tell Safar where you want to go." });
  }

  const brief = [
    `Create a complete pre-travel plan for: ${String(destination).trim()}`,
    country && `Country: ${country}`,
    `Use this exact destination (city, region, country). Do not substitute a different place with a similar name.`,
    startDate && `Trip starts: ${startDate}`,
    endDate && `Trip ends: ${endDate}`,
    days && `Duration: ${days} days`,
    travelers && `Travelers: ${travelers}`,
    budget && `Budget ceiling: ${budget}. Stay inside it. If that ceiling is above the style, do not spend up to it.`,
    styleGuide(style),
    interests && `Interests: ${interests}`,
    notes && `Extra notes: ${notes}`,
    `Currency: ${profile?.currency || "INR"}`,
    (origin || profile?.homeCity) && `Departing from: ${origin || profile.homeCity}`,
    profile?.nationality && `Passport: ${profile.nationality}. Visa advice must match this passport.`,
    Array.isArray(modes) && modes.length
      ? `Compare these ways to get there, one way, per adult: ${modes.filter(Boolean).join(", ")}. Fill rides for each of these modes only.`
      : "The traveler did not ask for a transport comparison. Set rides to [].",
    Array.isArray(modes) && modes.includes("flight")
      ? "Fill flightPicks with 1, 2, or 3 one-way flights, lowest fare first. Never more than 3."
      : "Set flightPicks to [].",
    stayBrief(stays, style),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const saved = await findGeneratedPlan(req.body || {});
    if (saved?.plan) {
      recordBuiltPlan(req, saved.plan, saved.model, true);
      return res.json({ plan: saved.plan, model: saved.model || "", cached: true });
    }

    const library = await listPlansForPlace(destination);
    const composed = composeFromLibrary(req.body || {}, library);
    if (composed.mode === "ready" && composed.plan) {
      const plan = applyStyleBudget(composed.plan, req.body || {});
      await saveGeneratedPlan(req.body || {}, plan, "composed");
      recordBuiltPlan(req, plan, "composed", true);
      return res.json({ plan, model: "composed", cached: true });
    }
    if (composed.mode === "gaps" && composed.brief) {
      try {
        const patch = await generateTravelReply({
          messages: [{ role: "user", content: composed.brief }],
          system: composed.system,
          json: true,
        });
        const merged = mergeGap(composed, parsePlanJson(patch.text));
        if (merged) {
          const plan = applyStyleBudget(merged, req.body || {});
          await saveGeneratedPlan(req.body || {}, plan, patch.model);
          recordBuiltPlan(req, plan, `patch · ${patch.model}`, false);
          return res.json({ plan, model: patch.model, cached: false });
        }
      } catch {
        /* A full plan still covers the trip when a small patch cannot be read. */
      }
    }

    const fullBrief = composed.locked?.length ? `${brief}\n\n${lockedBrief(composed.locked)}` : brief;
    const { text, model } = await generateTravelReply({
      messages: [{ role: "user", content: fullBrief }],
      system: `${SYSTEM_PROMPT}\n\n${PLAN_JSON_INSTRUCTIONS}${profileLine(profile, { includeName: false })}`,
      json: true,
    });
    const plan = applyStyleBudget(parsePlanJson(text), req.body || {});
    await saveGeneratedPlan(req.body || {}, plan, model);
    recordBuiltPlan(req, plan, model, false);
    return res.json({ plan, model });
  } catch (err) {
    logActivity(req, {
      action: "plan",
      query: String(destination).trim(),
      ok: false,
      error: err.message,
    });
    logSearch(req, {
      kind: "plan",
      destination,
      country,
      days,
      startDate,
      endDate,
      travelers,
      budget,
      style,
      interests,
      notes,
      ok: false,
      error: err.message,
    });
    const status = err.status || (err instanceof SyntaxError ? 502 : 500);
    return res.status(status).json({
      error:
        err instanceof SyntaxError
          ? "Safar drafted a plan but it could not be formatted. Please try again."
          : err.message || "Safar could not build this plan.",
    });
  }
});

router.post("/days/refresh", async (req, res) => {
  const destination = String(req.body?.destination || "").trim();
  if (!destination) return res.status(400).json({ error: "Tell Safar where you want to go." });
  const currentDays = Array.isArray(req.body?.days) ? req.body.days : [];
  const comment = String(req.body?.comment || "").trim();

  try {
    const library = await listPlansForPlace(destination);
    const refreshed = refreshDaysFromLibrary({ ...req.body, comment, destination }, library, currentDays);
    if (refreshed.mode === "ready" && refreshed.days?.length) {
      const plan = applyStyleBudget({ destination, country: req.body?.country, style: req.body?.style, days: refreshed.days }, req.body || {});
      return res.json({ days: plan.days, cached: true });
    }

    const { text, model } = await generateTravelReply({
      messages: [{ role: "user", content: refreshed.brief }],
      system: refreshed.system,
      json: true,
    });
    const parsed = parsePlanJson(text);
    const merged = refreshed.mode === "gaps" ? mergeGap(refreshed, parsed) : null;
    const days = merged?.days?.length ? merged.days : daysFromPatch(parsed);
    if (!days.length) throw new SyntaxError("Invalid days JSON");
    const plan = applyStyleBudget(
      {
        title: destination,
        destination,
        country: req.body?.country || "",
        style: req.body?.style,
        summary: comment,
        days,
      },
      req.body || {},
    );
    await saveGeneratedPlan(
      { ...req.body, destination, notes: comment, interests: comment || req.body?.interests },
      plan,
      model,
    );
    logActivity(req, { action: "plan", query: `refresh ${destination}`, ok: true, model });
    return res.json({ days: plan.days, model });
  } catch (err) {
    logActivity(req, { action: "plan", query: `refresh ${destination}`, ok: false, error: err.message });
    const status = err.status || (err instanceof SyntaxError ? 502 : 500);
    return res.status(status).json({
      error: err instanceof SyntaxError ? "Safar could not refresh these days. The old days are unchanged." : err.message || "Safar could not refresh these days.",
    });
  }
});

router.post("/plan/match", async (req, res) => {
  const destination = String(req.body?.destination || "").trim();
  if (!destination) return res.json({ plan: null });
  const saved = await findGeneratedPlan(req.body || {});
  if (!saved?.plan) return res.json({ plan: null });
  recordBuiltPlan(req, saved.plan, saved.model, true);
  return res.json({ plan: saved.plan, model: saved.model || "", cached: true });
});

router.post("/plan/library", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found." });
  }
  const destination = String(req.body?.destination || "").trim();
  const plan = req.body?.plan;
  if (!destination) return res.status(400).json({ error: "Tell Safar where you want to go." });
  if (!planMatchesRequest(req.body || {}, plan)) {
    return res.status(400).json({ error: "That plan does not match this trip." });
  }
  const model = String(req.body?.model || "").trim();
  await saveGeneratedPlan(req.body || {}, plan, model);
  recordBuiltPlan(req, plan, model, false);
  return res.json({ ok: true });
});

function asDay(parsed, dayNumber) {
  const raw =
    parsed?.morning || parsed?.afternoon || parsed?.evening || parsed?.title
      ? parsed
      : parsed?.day && typeof parsed.day === "object"
        ? parsed.day
        : Array.isArray(parsed?.days)
          ? parsed.days[0]
          : null;
  if (!raw || typeof raw !== "object") throw new SyntaxError("Invalid day JSON");
  return {
    day: dayNumber,
    title: String(raw.title || `Day ${dayNumber}`).trim(),
    morning: String(raw.morning || "").trim(),
    afternoon: String(raw.afternoon || "").trim(),
    evening: String(raw.evening || "").trim(),
    food: String(raw.food || "").trim(),
    cost: String(raw.cost || "").trim(),
  };
}

function otherDayLines(days) {
  if (!Array.isArray(days)) return "";
  return days
    .map((day) => {
      const bits = [day?.title, day?.morning, day?.afternoon, day?.evening].filter(Boolean).join(" — ");
      return bits ? `Day ${day.day || "?"}: ${bits}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

router.post("/day", async (req, res) => {
  const { destination, country, dayNumber, dayDate, comment, otherDays, profile } = req.body || {};
  const place = String(destination || "").trim();
  const number = Number(dayNumber);
  if (!place) return res.status(400).json({ error: "Tell Safar which trip this day belongs to." });
  if (!Number.isFinite(number) || number < 1) {
    return res.status(400).json({ error: "Tell Safar which day to rewrite." });
  }

  const note = String(comment || "").trim();
  const brief = [
    `Rewrite only day ${number} of a trip to ${place}.`,
    country && `Country: ${country}`,
    dayDate && `This day is: ${dayDate}`,
    `Currency: ${profile?.currency || "INR"}`,
    profile?.homeCity && `Departing from: ${profile.homeCity}`,
    profile?.nationality && `Passport: ${profile.nationality}`,
    otherDayLines(otherDays) && `Other days already planned. Do not repeat these places:\n${otherDayLines(otherDays)}`,
    note
      ? `The traveler wants this day to include: ${note}. Follow that text.`
      : "The traveler left no extra note. Write a strong day yourself that fits the trip and does not repeat the other days.",
    `Set "day" to ${number}.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, model } = await generateTravelReply({
      messages: [{ role: "user", content: brief }],
      system: `${SYSTEM_PROMPT}\n\n${DAY_JSON_INSTRUCTIONS}${profileLine(profile)}`,
      json: true,
    });
    const day = asDay(parsePlanJson(text), number);
    logActivity(req, {
      action: "plan",
      query: `${place} · day ${number}${note ? ` · ${note}` : ""}`,
      ok: true,
      model,
    });
    return res.json({ day, model });
  } catch (err) {
    logActivity(req, {
      action: "plan",
      query: `${place} · day ${number}`,
      ok: false,
      error: err.message,
    });
    const status = err.status || (err instanceof SyntaxError ? 502 : 500);
    return res.status(status).json({
      error:
        err instanceof SyntaxError
          ? "Safar drafted this day but it could not be formatted. The old day is unchanged."
          : err.message || "Safar could not rewrite this day. The old day is unchanged.",
    });
  }
});

router.post("/weekend", async (req, res) => {
  const profile = req.body?.profile || {};
  const homeCity = String(profile.homeCity || req.body?.homeCity || "").trim();
  if (!homeCity) return res.status(400).json({ error: "Add a home city to see a weekend idea." });

  const brief = [
    `Suggest one 2-day weekend trip from ${homeCity}.`,
    `Currency: ${profile.currency || "INR"}`,
    profile.nationality && `Passport: ${profile.nationality}`,
    "Choose a place someone could actually reach for a weekend. Do not choose the home city.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, model } = await generateTravelReply({
      messages: [{ role: "user", content: brief }],
      system: `${SYSTEM_PROMPT}\n\n${WEEKEND_JSON_INSTRUCTIONS}${profileLine(profile)}`,
      json: true,
    });
    const parsed = parsePlanJson(text);
    const destination = String(parsed?.destination || "").trim();
    if (!destination) throw new SyntaxError("Invalid weekend JSON");
    const idea = {
      destination,
      country: String(parsed.country || "").trim(),
      title: String(parsed.title || destination).trim(),
      summary: String(parsed.summary || "").trim(),
    };
    logActivity(req, { action: "plan", query: `weekend from ${homeCity}`, ok: true, model });
    return res.json({ idea, model });
  } catch (err) {
    logActivity(req, {
      action: "plan",
      query: `weekend from ${homeCity}`,
      ok: false,
      error: err.message,
    });
    const status = err.status || (err instanceof SyntaxError ? 502 : 500);
    return res.status(status).json({
      error: err instanceof SyntaxError ? "Safar could not shape a weekend idea. Try again." : err.message || "Safar could not find a weekend.",
    });
  }
});

router.post("/flights", async (req, res) => {
  const from = String(req.body?.from || "").trim();
  const to = String(req.body?.to || "").trim();
  const date = String(req.body?.date || "").trim();
  const adults = Math.min(9, Math.max(1, Number(req.body?.adults) || 1));
  const kids = Math.max(0, Number(req.body?.kids) || 0);
  const profile = req.body?.profile;
  if (!from || !to) return res.status(400).json({ error: "A flight suggestion needs a departure city and a destination." });

  const brief = [
    `Choose one-way flights from ${from} to ${to}.`,
    date && `Travel date: ${date}`,
    `Adults: ${adults}`,
    kids ? `Children: ${kids}` : "",
    `Currency: ${profile?.currency || "INR"}`,
    "Give 1, 2, or 3 flights. Never more than 3. Put the lower fare first.",
    "Each why sentence says the flight is a good choice at that cost and names the stops.",
  ]
    .filter(Boolean)
    .join("\n");

  const instructions = `Return ONLY valid JSON. No markdown fences. No commentary.
Schema: { "flightPicks": [{ "airline": "string", "via": "string", "stops": 1, "duration": "string", "typicalFare": "string", "fareLow": 0, "why": "string" }] }
Return 1, 2, or 3 one-way flights. Never more than 3. Order the lower fare first. stops is 0, 1, or 2. via is the connection city, or "" when nonstop. fareLow is the total for every adult as a number with no symbol. typicalFare is that same total with a currency symbol. why is one sentence that says this flight is a good choice and includes the fare and the stops. Name a real airline for the route. Do not invent booking URLs.`;

  try {
    const { text } = await generateTravelReply({
      messages: [{ role: "user", content: brief }],
      system: `${SYSTEM_PROMPT}\n\n${instructions}${profileLine(profile)}`,
      json: true,
    });
    const parsed = parsePlanJson(text);
    const flightPicks = (Array.isArray(parsed?.flightPicks) ? parsed.flightPicks : []).slice(0, 3);
    return res.json({ flightPicks });
  } catch (err) {
    const status = err.status || (err instanceof SyntaxError ? 502 : 500);
    return res.status(status).json({ error: err.message || "Could not choose flights for this date." });
  }
});

export default router;
