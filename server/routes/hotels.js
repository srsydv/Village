import { Router } from "express";
import { bookHotel, hotelProfile, hotelRooms, prebookHotel, searchHotels } from "../lib/hotels.js";
import { nuiteeConfigured, nuiteeSandbox } from "../lib/nuitee.js";
import { saveStay, staysFor } from "../lib/stays.js";

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

function countryOf(value) {
  const text = String(value || "IN").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(text) ? text : "IN";
}

function partyOf(value) {
  return Math.max(1, Math.min(6, Number(value) || 1));
}

router.get("/status", (_req, res) => {
  res.json({ enabled: nuiteeConfigured(), sandbox: nuiteeSandbox() });
});

router.post("/search", async (req, res, next) => {
  try {
    if (!nuiteeConfigured()) return res.json({ enabled: false, sandbox: false, hotels: [] });
    const src = req.body || {};
    const city = String(src.city || "").trim().slice(0, 60).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
    const latitude = Number(src.latitude);
    const longitude = Number(src.longitude);
    const nearby = Number.isFinite(latitude) && Number.isFinite(longitude);
    const checkin = cleanDate(src.checkin);
    const checkout = cleanDate(src.checkout);
    if (!nearby && city.length < 2) return res.status(400).json({ error: "Enter the city you want to stay in." });
    if (nearby && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
      return res.status(400).json({ error: "That location could not be used. Search by city instead." });
    }
    const distanceKm = Number(src.distanceKm);
    if (nearby && (!Number.isFinite(distanceKm) || distanceKm < 1 || distanceKm > 50)) {
      return res.status(400).json({ error: "Enter a distance from 1 to 50 km." });
    }
    if (!checkin) return res.status(400).json({ error: "Choose a check-in date that is still ahead." });
    if (!checkout || checkout <= checkin) return res.status(400).json({ error: "Check-out has to be after check-in." });
    const hotels = await searchHotels({
      city,
      country: countryOf(src.country),
      checkin,
      checkout,
      adults: partyOf(src.adults),
      currency: String(src.currency || "INR").slice(0, 3).toUpperCase() || "INR",
      latitude: nearby ? latitude : undefined,
      longitude: nearby ? longitude : undefined,
      radius: nearby ? distanceKm * 1000 : undefined,
    });
    res.json({
      enabled: true,
      sandbox: nuiteeSandbox(),
      city: nearby ? "" : city,
      nearby,
      checkin,
      checkout,
      hotels,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/rooms", async (req, res, next) => {
  try {
    const src = req.body || {};
    const hotelId = String(src.hotelId || "").trim().slice(0, 40);
    const checkin = cleanDate(src.checkin);
    const checkout = cleanDate(src.checkout);
    if (!hotelId) return res.status(400).json({ error: "Choose a hotel first." });
    if (!checkin || !checkout || checkout <= checkin) return res.status(400).json({ error: "Those dates are no longer valid. Search again." });
    const rooms = await hotelRooms({
      hotelId,
      country: countryOf(src.country),
      checkin,
      checkout,
      adults: partyOf(src.adults),
      currency: String(src.currency || "INR").slice(0, 3).toUpperCase() || "INR",
    });
    res.json({ sandbox: nuiteeSandbox(), rooms });
  } catch (err) {
    next(err);
  }
});

router.post("/detail", async (req, res, next) => {
  try {
    const hotelId = String(req.body?.hotelId || "").trim().slice(0, 40);
    if (!hotelId) return res.status(400).json({ error: "Choose a hotel first." });
    const hotel = await hotelProfile(hotelId);
    res.json({ sandbox: nuiteeSandbox(), hotel });
  } catch (err) {
    next(err);
  }
});

router.post("/prebook", async (req, res, next) => {
  try {
    const offerId = String(req.body?.offerId || "");
    if (!offerId) return res.status(400).json({ error: "This room expired. Search again." });
    const held = await prebookHotel(offerId);
    if (!held.prebookId || !held.secretKey || !held.transactionId) {
      return res.status(502).json({ error: "The room was held but payment did not open." });
    }
    res.json(held);
  } catch (err) {
    next(err);
  }
});

router.post("/book", async (req, res, next) => {
  try {
    const prebookId = String(req.body?.prebookId || "");
    const transactionId = String(req.body?.transactionId || "");
    const guest = req.body?.guest || {};
    if (!prebookId || !transactionId) {
      return res.status(400).json({ error: "Payment has to finish before the room can be booked." });
    }
    if (!guest.firstName || !guest.lastName || !guest.email) {
      return res.status(400).json({ error: "The guest needs a first name, last name, and email." });
    }
    const booked = await bookHotel({
      prebookId,
      transactionId,
      guest,
      stay: req.body?.stay || {},
    });
    if (!booked.bookingId) {
      return res.status(502).json({ error: "The booking partner has not returned a reference yet, so this stay is not confirmed." });
    }
    const stay = saveStay({
      ...booked,
      owner: ownerOf(req),
      email: String(guest.email).slice(0, 120),
      bookedAt: new Date().toISOString(),
    });
    res.json({ stay });
  } catch (err) {
    next(err);
  }
});

router.get("/stays", (req, res) => {
  res.json({ stays: staysFor(ownerOf(req)) });
});

export default router;
