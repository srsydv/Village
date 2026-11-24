const BASE = "https://api.liteapi.travel/v3.0";

export function nuiteeConfigured() {
  return Boolean(apiKey());
}

export function nuiteeSandbox() {
  return apiKey().startsWith("sand_");
}

function apiKey() {
  return String(process.env.NUITEE_API_KEY || process.env.LITEAPI_KEY || "").trim();
}

export function stripePublishableKey() {
  return String(process.env.NUITEE_STRIPE_PK || "").trim();
}

function messageFrom(data, fallback) {
  const raw = data?.error?.description || data?.error?.message || data?.message || fallback;
  return String(raw || fallback).replace(/\s+/g, " ").slice(0, 280);
}

export async function nuitee(path, { method = "GET", body, timeout = 28000, timeoutMessage } = {}) {
  const key = apiKey();
  if (!key) {
    const err = new Error("Live flight booking is not connected on this server.");
    err.status = 503;
    throw err;
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": key,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      const timeoutErr = new Error(timeoutMessage || "The airline is taking longer than usual. Tap Continue again. Nothing was charged.");
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(messageFrom(data, "The airline could not complete that step."));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  return data;
}

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function readPrice(node) {
  const display = node?.pricing?.display || node?.price || node || {};
  const total = money(display.total ?? display.totalAmount ?? display.amount);
  if (total == null) return null;
  return {
    total,
    base: money(display.base),
    taxes: money(display.taxes),
    fees: money(display.fees),
    currency: String(display.currency || node?.currency || "").toUpperCase(),
  };
}

function readSegments(list) {
  return asList(list)
    .map((segment) => {
      const carrier = segment.carrier || {};
      const number = String(segment.flight?.marketingNumber || "");
      const origin = String(segment.originCode || "").toUpperCase();
      const destination = String(segment.destinationCode || "").toUpperCase();
      if (!origin && !destination) return null;
      return {
        airline: String(carrier.marketingName || carrier.operatingName || ""),
        code: String(carrier.marketingCode || "").toUpperCase(),
        number: number ? `${carrier.marketingCode || ""} ${number}`.trim() : "",
        from: origin,
        to: destination,
        departAt: String(segment.departureTime || ""),
        arriveAt: String(segment.arrivalTime || ""),
        minutes: Number(segment.duration?.minutes) || 0,
      };
    })
    .filter(Boolean);
}

function readBags(baggage) {
  return asList(baggage?.included)
    .map((bag) => {
      const name = bag.description || bag.bagType || "";
      const weight = bag.weightKg ? `${bag.weightKg} kg` : "";
      const pieces = bag.pieces ? `${bag.pieces}× ` : "";
      return `${pieces}${name}${weight ? ` · ${weight}` : ""}`.trim();
    })
    .filter(Boolean);
}

function readTerms(terms) {
  return asList(terms?.summary)
    .map((item) => item?.message)
    .filter(Boolean);
}

function clock(iso) {
  const match = String(iso || "").match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function present(offer) {
  const first = offer.segments[0] || {};
  const last = offer.segments[offer.segments.length - 1] || first;
  const minutes = offer.segments.reduce((sum, segment) => sum + (segment.minutes || 0), 0);
  return {
    ...offer,
    airline: first.airline || "",
    flight: offer.segments.map((segment) => segment.number).filter(Boolean).join(" · "),
    from: first.from || "",
    to: last.to || "",
    depart: clock(first.departAt),
    arrive: clock(last.arriveAt),
    departAt: first.departAt || "",
    arriveAt: last.arriveAt || "",
    minutes,
    stopLabel: offer.stops === 0 ? "Nonstop" : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`,
  };
}

function fareFrom(offer, segments) {
  const price = readPrice(offer);
  if (!offer?.offerId || !price || !segments.length) return null;
  return present({
    offerId: offer.offerId,
    price,
    segments,
    stops: Math.max(0, segments.length - 1),
    baggage: readBags(offer.baggage),
    cabin: String(offer.segmentFares?.[0]?.cabin || offer.cabinClass || ""),
    family: String(offer.fare?.family || offer.segmentFares?.[0]?.fareFamily || ""),
    refundable: Boolean(offer.terms?.refundable ?? offer.fare?.refundable),
    changeable: Boolean(offer.terms?.changeable),
    seatsLeft: Number(offer.fare?.seatsRemaining) || null,
    terms: readTerms(offer.terms),
    expiresAt: offer.expiration || "",
  });
}

export function normalizeJourneys(payload) {
  const blocks = asList(payload?.data);
  const journeys = blocks.flatMap((block) => asList(block?.journeys).concat(block?.journey ? [block.journey] : []));
  const cards = [];
  for (const journey of journeys) {
    const segments = readSegments(journey.segments);
    const fares = asList(journey.offers).map((offer) => fareFrom(offer, segments)).filter(Boolean);
    if (!fares.length && journey.pricing) {
      const single = fareFrom({ ...journey, offerId: journey.offerId }, segments);
      if (single) fares.push(single);
    }
    if (!fares.length) continue;
    fares.sort((a, b) => a.price.total - b.price.total);
    cards.push({ ...fares[0], fares });
  }
  return cards.sort((a, b) => a.price.total - b.price.total).slice(0, 8);
}

export async function searchFlights({ origin, destination, date, currency = "INR", adults = 1 }) {
  const data = await nuitee("/flights/rates", {
    method: "POST",
    body: {
      legs: [{ origin, destination, date }],
      adults: Math.max(1, Math.min(6, Number(adults) || 1)),
      currency,
      country: "IN",
      cabinClass: "ECONOMY",
      sort: { sortBy: "price", sortOrder: "asc" },
    },
  });
  return normalizeJourneys(data);
}

export async function verifyFlight(offerId) {
  const data = await nuitee("/flights/verify", { method: "POST", body: { offerId } });
  const journey = data?.data?.[0]?.journey || data?.data?.journey || {};
  const segments = readSegments(journey.segments);
  const price = readPrice(journey);
  const offer = price && segments.length
    ? present({
        offerId,
        price,
        segments,
        stops: Math.max(0, segments.length - 1),
        baggage: readBags(journey.baggage),
        cabin: String(journey.segmentFares?.[0]?.cabin || journey.cabinClass || ""),
        family: String(journey.fare?.family || ""),
        refundable: Boolean(journey.terms?.refundable),
        changeable: Boolean(journey.terms?.changeable),
        seatsLeft: Number(journey.fare?.seatsRemaining) || null,
        terms: readTerms(journey.terms),
        expiresAt: journey.expiration || "",
      })
    : null;
  const changes = data?.data?.[0]?.changes || null;
  return { offer, changes };
}

function personName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "Traveler",
    lastName: parts.slice(1).join(" ") || parts[0] || "Traveler",
  };
}

function onePassenger(person, traveler) {
  const name = personName(person?.name);
  const gender = String(person?.gender || "M").toUpperCase().startsWith("F") ? "F" : "M";
  const passenger = {
    passengerType: 0,
    firstName: name.firstName,
    lastName: name.lastName,
    birthday: person?.birthday,
    gender,
    nationality: String(person?.nationality || traveler?.nationality || "IN").slice(0, 2).toUpperCase() || "IN",
    email: traveler?.email,
  };
  if (person?.documentNumber) {
    passenger.documentType = "passport";
    passenger.documentNumber = String(person.documentNumber).trim();
    if (person.documentExpiry) passenger.documentExpiry = person.documentExpiry;
    if (person.documentCountry) passenger.documentIssueCountry = person.documentCountry;
  }
  return passenger;
}

export function passengerBody(traveler, offerId) {
  const people = Array.isArray(traveler?.passengers) && traveler.passengers.length ? traveler.passengers : [traveler];
  const name = personName(people[0]?.name || traveler?.name);
  const phone = String(traveler?.phone || "").replace(/\D/g, "");
  const local = phone.length > 10 ? phone.slice(-10) : phone;
  return {
    offerId,
    usePaymentSdk: true,
    contact: {
      firstName: name.firstName,
      lastName: name.lastName,
      email: traveler?.email,
      phoneCountryCode: String(traveler?.phoneCountry || "91").replace(/\D/g, "") || "91",
      phoneNumber: local,
    },
    passengers: people.map((person) => onePassenger(person, traveler)),
  };
}

function servicesFrom(servicesAttachable) {
  const groups = asList(servicesAttachable?.groups);
  const seats = [];
  const extras = [];
  for (const group of groups) {
    const category = String(group.category || group.type || "").toLowerCase();
    for (const service of asList(group.services)) {
      const price = money(service.pricing?.display?.amount) || 0;
      const currency = service.pricing?.display?.currency || "INR";
      if (category === "seat" || category === "seats") {
        const seat = service.metadata?.seat || {};
        const row = Number(seat.seatRow);
        const column = String(seat.seatColumn || "");
        if (!row || !column) continue;
        seats.push({
          serviceId: service.serviceId,
          segmentKey: service.segmentKey || "",
          number: seat.seatNumber || service.name || `${row}${column}`,
          row,
          column,
          position: String(seat.position || ""),
          kind: String(seat.seatType || ""),
          available: seat.available === true,
          price,
          currency,
        });
      } else if (service.serviceId && service.name) {
        extras.push({
          serviceId: service.serviceId,
          segmentKey: service.segmentKey || "",
          name: String(service.name),
          category,
          price,
          currency,
        });
      }
    }
  }
  return { seats: seats.slice(0, 240), extras: extras.slice(0, 24) };
}

function paymentFrom(data) {
  const bag = Array.isArray(data?.data) ? data.data[0] || {} : data?.data || data || {};
  return {
    prebookId: String(bag.prebookId || ""),
    transactionId: String(bag.transactionId || ""),
    secretKey: String(bag.secretKey || ""),
    publicKey: String(bag.publishableKey || stripePublishableKey() || ""),
    total: money(bag.price ?? bag.pricing?.totalAmount),
    currency: String(bag.currency || bag.pricing?.currency || ""),
    ...servicesFrom(bag.servicesAttachable),
    sandbox: nuiteeSandbox(),
  };
}

export async function prebookFlight(traveler, offerId) {
  const data = await nuitee("/flights/prebooks", {
    method: "POST",
    body: passengerBody(traveler, offerId),
    timeout: 90000,
  });
  const held = paymentFrom(data);
  if (!held.prebookId) held.prebookId = String(data?.data?.[0]?.prebookId || "");
  return held;
}

export async function attachSeat(prebookId, services) {
  const selected = (Array.isArray(services) ? services : [services]).filter((item) => item?.serviceId);
  const data = await nuitee(`/flights/prebooks/${encodeURIComponent(prebookId)}/services`, {
    method: "POST",
    timeout: 90000,
    body: {
      selectedServices: selected.map((item) => ({
        serviceId: item.serviceId,
        segmentKey: item.segmentKey,
        passengerIndex: 0,
      })),
    },
  });
  const next = paymentFrom(data);
  return {
    ...next,
    prebookId: next.prebookId || prebookId,
  };
}

export async function readBooking(bookingId) {
  const data = await nuitee(`/flights/bookings/${encodeURIComponent(bookingId)}`);
  return presentBooking(data);
}

export async function bookFlight({ prebookId, transactionId }) {
  const data = await nuitee("/flights/bookings", {
    method: "POST",
    timeout: 300000,
    timeoutMessage: "The airline is still issuing the ticket. Check Tickets in a few minutes before paying again.",
    body: {
      prebookId,
      payment: { method: "TRANSACTION_ID", transactionId },
    },
  });
  return presentBooking(data);
}

function presentBooking(data) {
  const root = data?.data?.[0] || data?.data || data || {};
  const bag = root.booking || asList(root.bookings)[0] || root;
  const locators = asList(bag.airlineLocators || bag.locators);
  const orderId = bag.order?.reference?.orderId;
  return {
    bookingId: String(bag.bookingId || bag.id || ""),
    bookingRef: String(bag.bookingRef || orderId || ""),
    status: String(bag.status || ""),
    airlinePnr: locators.map((item) => item.airlinePnr || item.pnr).filter(Boolean).join(", "),
  };
}
