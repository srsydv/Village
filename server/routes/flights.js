import { Router } from "express";
import { airportCode, airportsIn } from "../lib/airports.js";
import { attachSeat, bookFlight, nuiteeConfigured, nuiteeSandbox, prebookFlight, readBooking, searchFlights, verifyFlight } from "../lib/nuitee.js";
import { saveTicket, ticketsFor } from "../lib/tickets.js";

const router = Router();

function ownerOf(req) {
  return req.user?.uid || String(req.get("x-safar-visitor") || "").slice(0, 80);
}

function cleanDate(value) {
  const text = String(value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const day = new Date(`${text}T12:00:00`);
  if (Number.isNaN(day.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (day < today) return "";
  return text;
}

router.get("/status", (_req, res) => {
  res.json({
    enabled: nuiteeConfigured(),
    sandbox: nuiteeSandbox(),
  });
});

router.post("/search", async (req, res, next) => {
  try {
    if (!nuiteeConfigured()) {
      return res.json({ enabled: false, sandbox: false, offers: [] });
    }
    const src = { ...(req.query || {}), ...(req.body && typeof req.body === "object" ? req.body : {}) };
    const heard = [src.question, src.from, src.to, src.home].filter(Boolean).join(" ");
    const mentioned = airportsIn(String(src.question || heard));
    const fromCodes = airportsIn(src.from);
    const toCodes = airportsIn(src.to);
    const origin = airportCode(src.origin) || (fromCodes.length === 1 ? fromCodes[0] : "") || mentioned[0] || airportCode(src.home);
    const destination = airportCode(src.destination) || (toCodes.length === 1 ? toCodes[0] : "") || mentioned.find((code) => code !== origin) || "";
    const date = cleanDate(src.date);
    if (!origin || !destination) {
      return res.status(400).json({ error: "Safar needs a known airport for both cities." });
    }
    if (origin === destination) {
      return res.status(400).json({ error: "The departure and arrival cities are the same." });
    }
    if (!date) return res.status(400).json({ error: "Choose a travel date that is still ahead." });
    const offers = await searchFlights({
      origin,
      destination,
      date,
      currency: String(src.currency || "INR").slice(0, 3).toUpperCase() || "INR",
      adults: Math.max(1, Math.min(6, Number(src.adults) || 1)),
    });
    res.json({
      enabled: true,
      sandbox: nuiteeSandbox(),
      from: origin,
      to: destination,
      date,
      offers,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/verify", async (req, res, next) => {
  try {
    const offerId = String(req.body?.offerId || "");
    if (!offerId) return res.status(400).json({ error: "Choose a flight first." });
    const checked = await verifyFlight(offerId);
    res.json({ sandbox: nuiteeSandbox(), ...checked, offerId });
  } catch (err) {
    next(err);
  }
});

router.post("/prebook", async (req, res, next) => {
  try {
    const offerId = String(req.body?.offerId || "");
    const traveler = req.body?.traveler || {};
    const people = Array.isArray(traveler.passengers) && traveler.passengers.length ? traveler.passengers : [traveler];
    if (!offerId) return res.status(400).json({ error: "This fare expired. Search again." });
    if (!traveler.email || !traveler.phone || people.some((person) => !person?.name || !person?.birthday)) {
      return res.status(400).json({ error: "Each traveler needs a name and date of birth, plus a phone and email." });
    }
    const held = await prebookFlight(traveler, offerId);
    if (!held.prebookId || !held.secretKey || !held.transactionId) {
      return res.status(502).json({ error: "The airline held the seat but did not open payment." });
    }
    res.json(held);
  } catch (err) {
    next(err);
  }
});

router.post("/services", async (req, res, next) => {
  try {
    const prebookId = String(req.body?.prebookId || "");
    const chosen = [req.body?.seat, ...(Array.isArray(req.body?.extras) ? req.body.extras : [])].filter((item) => item?.serviceId);
    if (!prebookId || !chosen.length) return res.status(400).json({ error: "Choose a seat or a bag first." });
    const held = await attachSeat(prebookId, chosen);
    if (!held.secretKey || !held.transactionId) {
      return res.status(502).json({ error: "The seat was not added, so the price was left unchanged." });
    }
    res.json({ ...held, prebookId });
  } catch (err) {
    next(err);
  }
});

router.post("/book", async (req, res, next) => {
  try {
    const prebookId = String(req.body?.prebookId || "");
    const transactionId = String(req.body?.transactionId || "");
    if (!prebookId || !transactionId) {
      return res.status(400).json({ error: "Payment has to finish before the ticket can be issued." });
    }
    const booked = await bookFlight({ prebookId, transactionId });
    if (!booked.bookingId && !booked.bookingRef) {
      return res.status(502).json({ error: "The booking partner has not returned a reference yet, so this is not confirmed." });
    }
    const ticket = saveTicket({
      ...booked,
      owner: ownerOf(req),
      email: String(req.body?.email || "").slice(0, 120),
      name: String(req.body?.name || "").slice(0, 80),
      from: String(req.body?.from || "").slice(0, 8),
      to: String(req.body?.to || "").slice(0, 8),
      date: String(req.body?.date || "").slice(0, 10),
      airline: String(req.body?.airline || "").slice(0, 80),
      flight: String(req.body?.flight || "").slice(0, 40),
      depart: String(req.body?.depart || "").slice(0, 8),
      arrive: String(req.body?.arrive || "").slice(0, 8),
      total: Number(req.body?.total) || null,
      currency: String(req.body?.currency || "").slice(0, 3),
      sandbox: nuiteeSandbox(),
      bookedAt: new Date().toISOString(),
    });
    res.json({ ticket });
  } catch (err) {
    next(err);
  }
});

router.get("/tickets", async (req, res, next) => {
  try {
    const stored = ticketsFor(ownerOf(req));
    const tickets = [];
    for (const ticket of stored) tickets.push(await freshTicket(ticket));
    res.json({ tickets });
  } catch (err) {
    next(err);
  }
});

async function freshTicket(ticket) {
  if (!ticket.bookingId) return ticket;
  try {
    const live = await readBooking(ticket.bookingId);
    if (!live.bookingRef && !live.status && !live.airlinePnr) return ticket;
    return saveTicket({
      ...ticket,
      bookingRef: live.bookingRef || ticket.bookingRef,
      status: live.status || ticket.status,
      airlinePnr: live.airlinePnr || ticket.airlinePnr,
    });
  } catch {
    return ticket;
  }
}

export default router;
