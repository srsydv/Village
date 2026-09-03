import { Router } from "express";
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

      const { model } = await streamTravelReply({
        messages,
        system,
        onDelta: (delta) => {
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        },
      });
      res.write(`data: ${JSON.stringify({ done: true, model })}\n\n`);
      return res.end();
    }

    const { text, model } = await generateTravelReply({ messages, system });
    return res.json({ text, model });
  } catch (err) {
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
    days,
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
    });
    const plan = parsePlanJson(text);
    return res.json({ plan, model });
  } catch (err) {
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
