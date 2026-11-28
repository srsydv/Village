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

export async function nuitee(path, { method = "GET", body, timeout = 28000, timeoutMessage, raw = false, fallback = "The airline could not complete that step." } = {}) {
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
    const err = new Error(messageFrom(data, fallback));
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  if (raw) return { status: res.status, data };
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
      const row = {
        airline: String(carrier.marketingName || carrier.operatingName || "").trim(),
        code: String(carrier.marketingCode || "").trim().toUpperCase(),
        from: origin,
        to: destination,
        fromName: String(segment.originName || segment.origin?.name || "").trim(),
        toName: String(segment.destinationName || segment.destination?.name || "").trim(),
        departAt: String(segment.departureTime || "").trim(),
        arriveAt: String(segment.arrivalTime || "").trim(),
        minutes: Number(segment.duration?.minutes) || 0,
        direction: String(segment.direction || "").toUpperCase(),
      };
      const flightNo = number ? `${row.code} ${number}`.trim() : "";
      if (flightNo) row.number = flightNo;
      const logo = String(carrier.marketingLogo || carrier.operatingLogo || "").trim();
      if (logo.startsWith("https://")) row.logo = logo;
      return row;
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

function summarizeLeg(segments) {
  const first = segments[0] || {};
  const last = segments[segments.length - 1] || first;
  const stops = Math.max(0, segments.length - 1);
  return {
    airline: first.airline || "",
    flight: segments.map((segment) => segment.number).filter(Boolean).join(" · "),
    from: first.from || "",
    to: last.to || "",
    depart: clock(first.departAt),
    arrive: clock(last.arriveAt),
    departAt: first.departAt || "",
    arriveAt: last.arriveAt || "",
    minutes: segments.reduce((sum, segment) => sum + (segment.minutes || 0), 0),
    stops,
    stopLabel: stops === 0 ? "Nonstop" : `${stops} stop${stops > 1 ? "s" : ""}`,
    segments,
  };
}

function splitDirections(segments, destination) {
  const inboundAt = segments.findIndex((segment) => segment.direction === "INBOUND");
  if (inboundAt > 0) return [segments.slice(0, inboundAt), segments.slice(inboundAt)];
  const dest = String(destination || "").toUpperCase();
  const cut = dest ? segments.findIndex((segment) => segment.to === dest) : -1;
  if (cut >= 0 && cut < segments.length - 1) return [segments.slice(0, cut + 1), segments.slice(cut + 1)];
  return [segments];
}

function present(offer, destination) {
  const legs = splitDirections(offer.segments, destination).filter((group) => group.length).map(summarizeLeg);
  const outbound = legs[0] || {};
  return {
    ...offer,
    legs,
    airline: outbound.airline || "",
    flight: outbound.flight || "",
    from: outbound.from || "",
    to: outbound.to || "",
    depart: outbound.depart || "",
    arrive: outbound.arrive || "",
    departAt: outbound.departAt || "",
    arriveAt: outbound.arriveAt || "",
    minutes: outbound.minutes || 0,
    stopLabel: outbound.stopLabel || "",
  };
}

function fareFrom(offer, segments, destination) {
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
  }, destination);
}

export function normalizeJourneys(payload, destination = "") {
  const blocks = asList(payload?.data);
  const journeys = blocks.flatMap((block) => asList(block?.journeys).concat(block?.journey ? [block.journey] : []));
  const cards = [];
  for (const journey of journeys) {
    const segments = readSegments(journey.segments);
    const fares = asList(journey.offers).map((offer) => fareFrom(offer, segments, destination)).filter(Boolean);
    if (!fares.length && journey.pricing) {
      const single = fareFrom({ ...journey, offerId: journey.offerId }, segments, destination);
      if (single) fares.push(single);
    }
    if (!fares.length) continue;
    fares.sort((a, b) => a.price.total - b.price.total);
    cards.push({ ...fares[0], fares });
  }
  return cards.sort((a, b) => a.price.total - b.price.total).slice(0, 8);
}

export async function searchFlights({ origin, destination, date, returnDate, currency = "INR", adults = 1 }) {
  const legs = [{ origin, destination, date, direction: "OUTBOUND" }];
  if (returnDate) legs.push({ origin: destination, destination: origin, date: returnDate, direction: "INBOUND" });
  const data = await nuitee("/flights/rates", {
    method: "POST",
    body: {
      legs,
      adults: Math.max(1, Math.min(6, Number(adults) || 1)),
      currency,
      country: "IN",
      cabinClass: "ECONOMY",
      sort: { sortBy: "price", sortOrder: "asc" },
    },
  });
  return normalizeJourneys(data, destination);
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

function httpsUrl(value) {
  const text = String(value || "").trim();
  return text.startsWith("https://") ? text : "";
}

function readBookingSegments(list) {
  return asList(list).map((segment) => {
    const carrier = segment?.carrier || {};
    const number = String(segment?.flight?.marketingNumber || "").trim();
    const code = String(carrier.marketingCode || "").trim().toUpperCase();
    const from = String(segment?.originCode || "").trim().toUpperCase();
    const to = String(segment?.destinationCode || "").trim().toUpperCase();
    if (!from && !to) return null;
    const row = {
      airline: String(carrier.marketingName || carrier.operatingName || "").trim(),
      code,
      from,
      to,
      fromName: String(segment?.originName || "").trim(),
      toName: String(segment?.destinationName || "").trim(),
      departAt: String(segment?.departureTime || "").trim(),
      arriveAt: String(segment?.arrivalTime || "").trim(),
    };
    if (number) row.number = `${code} ${number}`.trim();
    const logo = httpsUrl(carrier.marketingLogo || carrier.operatingLogo);
    if (logo) row.logo = logo;
    const minutes = Number(segment?.duration?.minutes);
    if (Number.isFinite(minutes) && minutes > 0) row.minutes = minutes;
    return row;
  }).filter(Boolean);
}

function readIncludedBags(baggage) {
  return asList(baggage?.included).map((bag) => {
    const row = {};
    const name = String(bag?.description || bag?.bagType || "").trim();
    if (name) row.name = name;
    const pieces = Number(bag?.pieces);
    if (Number.isFinite(pieces) && pieces > 0) row.pieces = pieces;
    const weight = Number(bag?.weightKg);
    if (Number.isFinite(weight) && weight > 0) row.weightKg = weight;
    const size = String(bag?.size || "").trim();
    if (size) row.size = size;
    return Object.keys(row).length ? row : null;
  }).filter(Boolean);
}

function readPassengers(list) {
  return asList(list).map((person) => {
    const row = {};
    const name = [person?.firstName, person?.lastName].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
    if (name) row.name = name;
    const birthday = String(person?.birthday || "").trim();
    if (birthday) row.birthday = birthday;
    const gender = String(person?.gender || "").trim();
    if (gender) row.gender = gender;
    const nationality = String(person?.nationality || "").trim();
    if (nationality) row.nationality = nationality;
    return Object.keys(row).length ? row : null;
  }).filter(Boolean);
}

function readExtras(list) {
  return asList(list).map((item) => {
    const priced = amountOf(item?.pricing || item);
    const name = String(item?.name || "").trim();
    if (!name && !priced) return null;
    return { ...(name ? { name } : {}), ...(priced || {}) };
  }).filter(Boolean);
}

function readContact(contact) {
  if (!contact || typeof contact !== "object") return null;
  const row = {};
  const email = String(contact.email || "").trim();
  if (email) row.email = email;
  const phone = String(contact.phoneNumber || "").trim();
  const code = String(contact.phoneCountryCode || "").replace(/\D/g, "");
  if (phone && code) row.phone = `+${code} ${phone}`;
  else if (phone) row.phone = phone;
  return Object.keys(row).length ? row : null;
}

export function readBookingDetail(data) {
  const root = data?.data?.[0] || data?.data || data || {};
  const bag = root.booking || asList(root.bookings)[0] || root;
  const journey = bag.journey || {};
  const segments = readBookingSegments(journey.segments);
  const price = readPrice(journey);
  const detail = {
    bookingId: String(bag.bookingId || bag.id || ""),
    bookingRef: String(bag.bookingRef || bag.order?.reference?.orderId || ""),
    status: String(bag.status || ""),
    segments,
    bags: readIncludedBags(journey.baggage),
    extras: readExtras(bag.bookedServices),
    terms: readTerms(journey.terms),
    passengers: readPassengers(bag.passengers),
  };
  const paidAmount = money(bag.payment?.amount ?? bag.pricing?.totalAmount);
  if (paidAmount != null) {
    detail.paid = { amount: paidAmount };
    const paidCurrency = String(bag.payment?.currency || bag.pricing?.currency || price?.currency || "").trim().toUpperCase();
    if (paidCurrency) detail.paid.currency = paidCurrency;
  }
  const locators = asList(bag.airlineLocators);
  const pnr = locators.map((item) => item?.airlinePnr).filter(Boolean).join(", ");
  if (pnr) detail.airlinePnr = pnr;
  const ticketNumbers = [...new Set(asList(bag.ticketData?.tickets)
    .map((item) => String(item?.ticketNumber || "").trim())
    .filter((number) => number && number !== pnr))];
  if (ticketNumbers.length) detail.ticketNumbers = ticketNumbers;
  const cabin = String(journey.segmentFares?.[0]?.cabin || journey.cabinClass || "").trim();
  if (cabin) detail.cabin = cabin;
  const family = String(journey.fare?.family || journey.segmentFares?.[0]?.fareFamily || "").trim();
  if (family) detail.family = family;
  if (price) detail.price = price;
  const contact = readContact(bag.contact);
  if (contact) detail.contact = contact;
  if (bag.cancelIntentAt) detail.cancelPending = true;
  return detail;
}

export async function readBooking(bookingId) {
  const data = await nuitee(`/flights/bookings/${encodeURIComponent(bookingId)}`);
  return presentBooking(data);
}

export async function readBookingRecord(bookingId) {
  const data = await nuitee(`/flights/bookings/${encodeURIComponent(bookingId)}`);
  return readBookingDetail(data);
}

function amountOf(node) {
  if (node == null || node === "") return null;
  if (typeof node === "number" || typeof node === "string") {
    const amount = money(node);
    return amount == null ? null : { amount };
  }
  const display = node.display || node.pricing?.display;
  const amount = money(display?.amount ?? display?.total ?? node.amount ?? node.total);
  if (amount == null) return null;
  const priced = { amount };
  const currency = String(display?.currency || node.currency || "").trim().toUpperCase();
  if (currency) priced.currency = currency;
  return priced;
}

function namedAmounts(list) {
  return asList(list).map((item) => {
    const priced = amountOf(item);
    const name = String(item?.description || item?.name || "").trim();
    if (!priced && !name) return null;
    return { ...(name ? { name } : {}), ...(priced || {}) };
  }).filter(Boolean).slice(0, 8);
}

function cancelNode(data) {
  const root = asList(data?.data)[0] || data?.data || data || {};
  return root.booking || root;
}

export function readCancelQuote(data) {
  const item = cancelNode(data);
  const quote = {};
  if (typeof item.isRefundable === "boolean") quote.refundable = item.isRefundable;
  if (typeof item.isVoidable === "boolean") quote.voidable = item.isVoidable;
  const confidence = String(item.confidence || "").trim();
  if (confidence) quote.confidence = confidence;
  const refund = amountOf(item.refund);
  if (refund) quote.refund = refund;
  const penalty = amountOf(item.penalty);
  if (penalty) quote.penalty = penalty;
  const penalties = namedAmounts(item.penalties);
  if (penalties.length) quote.penalties = penalties;
  const destination = String(item.destination || "").trim();
  if (destination) quote.destination = destination;
  const vouchers = namedAmounts(item.vouchers);
  if (vouchers.length) quote.vouchers = vouchers;
  return quote;
}

export function readCancelResult(data, httpStatus) {
  const item = cancelNode(data);
  const status = String(item.status || "").trim();
  const final = status === "CANCELLED" || status === "CANCELLED_WITH_CHARGES";
  const result = { pending: !final || httpStatus === 202 };
  if (final) result.pending = false;
  if (status) result.status = status;
  const refund = amountOf(item.refund_amount ?? item.refund);
  if (refund) {
    if (!refund.currency && item.currency) refund.currency = String(item.currency).trim().toUpperCase();
    result.refund = refund;
  }
  const fee = amountOf(item.cancellation_fee ?? item.penalty);
  if (fee) {
    if (!fee.currency && item.currency) fee.currency = String(item.currency).trim().toUpperCase();
    result.fee = fee;
  }
  const destination = String(item.destination || "").trim();
  if (destination) result.destination = destination;
  const vouchers = namedAmounts(item.vouchers);
  if (vouchers.length) result.vouchers = vouchers;
  return result;
}

export async function quoteCancellation(bookingId) {
  const data = await nuitee(`/flights/bookings/${encodeURIComponent(bookingId)}/cancellations`, {
    timeout: 45000,
    timeoutMessage: "The booking partner did not return a cancellation quote. The ticket is unchanged.",
  });
  return readCancelQuote(data);
}

export async function cancelBooking(bookingId) {
  const { status, data } = await nuitee(`/flights/bookings/${encodeURIComponent(bookingId)}/cancellations`, {
    method: "POST",
    raw: true,
    timeout: 90000,
    timeoutMessage: "The airline is still confirming the cancellation. Check Tickets before trying again.",
  });
  return readCancelResult(data, status);
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
