import { Router } from "express";
import { logActivity, lastUserText } from "../lib/activity.js";
import { logSearch } from "../lib/searches.js";
import { planSnapshot } from "../lib/snapshot.js";
import {
  PLAN_JSON_INSTRUCTIONS,
  SYSTEM_PROMPT,
  generateTravelReply,
  parsePlanJson,
  streamTravelReply,
} from "../lib/gemini.js";

const router = Router();

function profileLine(profile) {
  if (!profile || typeof profile !== "object") return "";
  const bits = [
    profile.name && `Traveler name: ${profile.name}`,
    profile.homeCity && `Home city: ${profile.homeCity}`,
    profile.currency && `Preferred currency: ${profile.currency}`,
  ].filter(Boolean);
  return bits.length ? `\n\nTraveler profile:\n${bits.join("\n")}` : "";
}

router.post("/chat", async (req, res) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages.slice(-16) : [];
  const profile = req.body?.profile;
  const stream = req.body?.stream !== false;

  if (!messages.length || !messages.some((m) => m.role === "user")) {
    return res.status(400).json({ error: "Please ask Aurea something about your trip." });
  }

  const system = SYSTEM_PROMPT + profileLine(profile);

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
      res.write(`data: ${JSON.stringify({ error: err.message || "Aurea could not reply." })}\n\n`);
      return res.end();
    }
    return res.status(status).json({ error: err.message || "Aurea could not reply." });
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
    profile,
  } = req.body || {};

  if (!destination || !String(destination).trim()) {
    return res.status(400).json({ error: "Tell Aurea where you want to go." });
  }

  const brief = [
    `Create a complete pre-travel plan for: ${String(destination).trim()}`,
    country && `Country: ${country}`,
    `Use this exact destination (city, region, country). Do not substitute a different place with a similar name.`,
    startDate && `Trip starts: ${startDate}`,
    endDate && `Trip ends: ${endDate}`,
    days && `Duration: ${days} days`,
    travelers && `Travelers: ${travelers}`,
    budget && `Budget: ${budget}`,
    style && `Travel style: ${style}`,
    interests && `Interests: ${interests}`,
    notes && `Extra notes: ${notes}`,
    `Currency: ${profile?.currency || "INR"}`,
    profile?.homeCity && `Departing from: ${profile.homeCity}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, model } = await generateTravelReply({
      messages: [{ role: "user", content: brief }],
      system: `${SYSTEM_PROMPT}\n\n${PLAN_JSON_INSTRUCTIONS}${profileLine(profile)}`,
      json: true,
    });
    const plan = parsePlanJson(text);
    const snapshot = planSnapshot(plan);
    logActivity(req, {
      action: "plan",
      query: String(destination).trim(),
      ok: true,
      model,
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
      model,
      resultTitle: plan.title || plan.destination,
      resultDuration: plan.duration || plan.daysCount,
      resultBudget: plan.expenses?.total || plan.budget?.total,
      resultPlan: snapshot,
    });
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
          ? "Aurea drafted a plan but it could not be formatted. Please try again."
          : err.message || "Aurea could not build this plan.",
    });
  }
});

export default router;
