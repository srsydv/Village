import { nuitee, nuiteeSandbox } from "./nuitee.js";

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function httpsUrl(value) {
  const url = String(value || "").trim();
  return url.startsWith("https://") ? url : "";
}

function amountOf(node) {
  if (node == null) return null;
  if (typeof node === "number") return { total: money(node), currency: "" };
  if (Array.isArray(node)) return amountOf(node[0]);
  if (typeof node === "object") {
    if (node.amount != null) return { total: money(node.amount), currency: String(node.currency || "") };
    if (node.total != null) {
      const nested = amountOf(node.total);
      if (nested && !nested.currency && node.currency) nested.currency = String(node.currency);
      return nested;
    }
  }
  return null;
}

function refundOf(policies) {
  const tag = String(policies?.refundableTag || "");
  const refundable = tag === "RFN" ? true : tag === "NRFN" ? false : null;
  const info = Array.isArray(policies?.cancelPolicyInfos) ? policies.cancelPolicyInfos[0] : null;
  const fee = money(info?.amount);
  const row = {};
  if (refundable != null) row.refundable = refundable;
  if (info?.cancelTime) row.cancelAt = String(info.cancelTime);
  if (fee != null) row.cancelFee = fee;
  if (info?.currency) row.cancelCurrency = String(info.currency);
  return row;
}

function rateOf(offer) {
  const rate = offer?.rates?.[0] || {};
  const price = amountOf(offer?.offerRetailRate) || amountOf(rate?.retailRate);
  if (!offer?.offerId || !price || price.total == null) return null;
  return {
    offerId: String(offer.offerId),
    room: String(rate.name || "").trim(),
    board: String(rate.boardName || "").trim(),
    adults: Number(rate.adultCount) || null,
    ...refundOf(rate.cancellationPolicies),
    total: price.total,
    currency: price.currency || "",
  };
}

function photosOf(content) {
  const list = [];
  const push = (value) => {
    const url = httpsUrl(typeof value === "string" ? value : value?.url || value?.urlHd || value?.hd_url);
    if (url && !list.includes(url)) list.push(url);
  };
  push(content?.main_photo);
  push(content?.thumbnail);
  for (const bag of [content?.hotelImages, content?.images, content?.photos]) {
    if (Array.isArray(bag)) bag.forEach(push);
  }
  return list.slice(0, 8);
}

function hotelOf(content, rate) {
  const photos = photosOf(content);
  const stars = Number(content?.stars);
  const rating = Number(content?.rating);
  const reviews = Number(content?.review_count);
  const row = {
    hotelId: String(content?.id || rate?.hotelId || ""),
    name: String(content?.name || "").trim(),
    address: String(content?.address || "").trim(),
    city: String(content?.city_name || "").trim(),
    ...rate,
  };
  if (photos.length) {
    row.photo = photos[0];
    row.photos = photos;
  }
  if (Number.isFinite(stars) && stars > 0) row.stars = stars;
  if (Number.isFinite(rating) && rating > 0) row.rating = rating;
  if (Number.isFinite(reviews) && reviews > 0) row.reviews = reviews;
  return row.name ? row : null;
}

function kmBetween(fromLat, fromLng, toLat, toLng) {
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) return null;
  const rad = (value) => (value * Math.PI) / 180;
  const dLat = rad(toLat - fromLat);
  const dLng = rad(toLng - fromLng);
  const span = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(fromLat)) * Math.cos(rad(toLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(span), Math.sqrt(1 - span)) * 10) / 10;
}

function presentRates(data, limit, center) {
  const content = new Map((data?.hotels || []).map((hotel) => [String(hotel.id), hotel]));
  const rows = [];
  for (const hotel of data?.data || []) {
    const info = content.get(String(hotel.hotelId));
    for (const offer of hotel.roomTypes || []) {
      const rate = rateOf(offer);
      if (!rate) continue;
      const row = hotelOf(info, { ...rate, hotelId: hotel.hotelId });
      if (!row) continue;
      const distance = center ? kmBetween(center.latitude, center.longitude, Number(info?.latitude), Number(info?.longitude)) : null;
      if (distance != null) row.distanceKm = distance;
      rows.push(row);
    }
  }
  rows.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999) || a.total - b.total);
  return rows.slice(0, limit);
}

export async function searchHotels({ city, country, checkin, checkout, adults, currency, latitude, longitude, radius }) {
  const nearby = Number.isFinite(latitude) && Number.isFinite(longitude);
  const radiusMeters = nearby ? Math.max(1000, Math.min(50000, Math.round(Number(radius) || 10000))) : undefined;
  const data = await nuitee("/hotels/rates", {
    method: "POST",
    timeout: 20000,
    timeoutMessage: "Hotel search is taking longer than usual. Try again.",
    fallback: nearby ? "The hotel partner could not search near this location." : "The hotel partner could not search that city.",
    body: {
      ...(nearby ? { latitude, longitude, radius: radiusMeters } : { cityName: city, countryCode: country }),
      checkin,
      checkout,
      currency,
      guestNationality: country,
      occupancies: [{ adults }],
      maxRatesPerHotel: 1,
    },
  });
  if (data?.error) {
    const description = data.error.description || data.error.message || "";
    if (!nearby && /no availability/i.test(description)) return listCityHotels(city, country);
    const err = new Error(description || "No stays came back for that search.");
    err.status = 502;
    throw err;
  }
  return presentRates(data, 12, nearby ? { latitude, longitude } : null);
}

function catalogHotel(hotel) {
  const name = String(hotel?.name || "").trim();
  if (!name || hotel.deletedAt) return null;
  const photo = [hotel.main_photo, hotel.thumbnail].find((src) => /^https:\/\//.test(String(src || "")));
  const stars = Number(hotel.stars);
  const rating = Number(hotel.rating);
  const reviews = Number(hotel.reviewCount);
  return {
    hotelId: String(hotel.id || hotel.primaryHotelId || name),
    name,
    city: hotel.city || "",
    address: hotel.address || "",
    photo: photo || "",
    ...(photo ? { photos: [photo] } : {}),
    ...(stars > 0 ? { stars } : {}),
    ...(rating > 0 ? { rating } : {}),
    ...(reviews > 0 ? { reviews } : {}),
    catalog: true,
  };
}

async function listCityHotels(city, country) {
  const data = await nuitee(`/data/hotels?countryCode=${encodeURIComponent(country)}&cityName=${encodeURIComponent(city)}`, {
    timeout: 20000,
    fallback: "The hotel partner could not list that city.",
  });
  return (Array.isArray(data?.data) ? data.data : [])
    .map(catalogHotel)
    .filter(Boolean)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name))
    .slice(0, 12);
}

export async function hotelRooms({ hotelId, country, checkin, checkout, adults, currency }) {
  const data = await nuitee("/hotels/rates", {
    method: "POST",
    timeout: 25000,
    timeoutMessage: "The rooms are taking longer than usual. Try again.",
    fallback: "The hotel partner could not load rooms.",
    body: {
      hotelIds: [hotelId],
      checkin,
      checkout,
      currency,
      guestNationality: country,
      occupancies: [{ adults }],
      maxRatesPerHotel: 8,
      includeHotelData: true,
    },
  });
  if (data?.error) {
    const err = new Error(data.error.description || data.error.message || "No rooms came back for that hotel.");
    err.status = 502;
    throw err;
  }
  return presentRates(data, 8);
}

function plainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function photoEntries(items, limit) {
  const list = [];
  for (const item of Array.isArray(items) ? items : []) {
    const url = httpsUrl(item?.urlHd || item?.hd_url || item?.url || (typeof item === "string" ? item : ""));
    const caption = plainText(item?.caption || item?.imageDescription || "").slice(0, 140);
    if (!url || list.some((photo) => photo.url === url)) continue;
    list.push(caption ? { url, caption } : { url });
    if (list.length >= limit) break;
  }
  return list;
}

function nameList(items, limit) {
  const list = [];
  for (const item of Array.isArray(items) ? items : []) {
    const name = plainText(typeof item === "string" ? item : item?.name).slice(0, 80);
    if (name && !list.includes(name)) list.push(name);
    if (list.length >= limit) break;
  }
  return list;
}

function bedLine(beds) {
  if (!Array.isArray(beds)) return "";
  return beds.map((bed) => {
    const type = plainText(bed?.bedType);
    if (!type) return "";
    const count = Number(bed.quantity);
    const size = plainText(bed?.bedSize);
    return `${Number.isFinite(count) && count > 0 ? `${count} ` : ""}${type}${size ? ` (${size})` : ""}`;
  }).filter(Boolean).join(", ");
}

function parkingText(value) {
  const text = String(value || "").trim();
  if (text === "NOT_AVAILABLE") return "Not available";
  if (text === "AVAILABLE") return "Available";
  if (text === "FREE") return "Free";
  return "";
}

function presentHotel(hotel, reviews) {
  const source = hotel?.data && hotel.data.id ? hotel.data : hotel || {};
  const times = source.checkinCheckoutTimes || {};
  const policy = source.policyAttributes || {};
  const pets = typeof policy.pets?.allowed === "boolean" ? policy.pets.allowed : typeof source.petsAllowed === "boolean" ? source.petsAllowed : null;
  const children = typeof policy.children?.allowed === "boolean" ? policy.children.allowed : typeof source.childAllowed === "boolean" ? source.childAllowed : null;
  const latitude = Number(source.location?.latitude ?? source.latitude);
  const longitude = Number(source.location?.longitude ?? source.longitude);
  const rating = Number(source.rating);
  const reviewCount = Number(source.reviewCount ?? source.review_count);
  const categories = (source.sentiment_analysis?.categories || []).map((item) => {
    const score = Number(item?.rating);
    const name = plainText(item?.name).slice(0, 40);
    if (!name || !Number.isFinite(score)) return null;
    const description = plainText(item?.description).slice(0, 220);
    return description ? { name, rating: score, description } : { name, rating: score };
  }).filter(Boolean);
  const reviewList = (Array.isArray(reviews?.data) ? reviews.data : Array.isArray(reviews) ? reviews : []).slice(0, 6).map((item) => {
    const score = Number(item?.averageScore);
    const row = {
      name: plainText(item?.name).slice(0, 60),
      date: String(item?.date || "").slice(0, 10),
      headline: plainText(item?.headline).slice(0, 180),
      pros: plainText(item?.pros).slice(0, 400),
      cons: plainText(item?.cons).slice(0, 400),
      country: plainText(item?.country).slice(0, 8),
    };
    if (Number.isFinite(score)) row.score = score;
    if (!row.headline && !row.pros && !row.cons) return null;
    return row;
  }).filter(Boolean);
  const rooms = (Array.isArray(source.rooms) ? source.rooms : []).slice(0, 12).map((room) => {
    const size = Number(room.roomSizeSquare);
    const unit = plainText(room.roomSizeUnit);
    const sleeps = Number(room.maxOccupancy || room.maxAdults);
    const row = {
      id: String(room.id || room.roomName || ""),
      name: plainText(room.roomName || room.roomTitle).slice(0, 120),
      description: plainText(room.description).slice(0, 500),
      beds: bedLine(room.bedTypes),
      amenities: nameList(room.roomAmenities, 12),
      photos: photoEntries(room.photos, 6).map((photo) => photo.url),
    };
    if (Number.isFinite(size) && size > 0 && unit) row.size = `${size} ${unit}`;
    if (Number.isFinite(sleeps) && sleeps > 0) row.sleeps = sleeps;
    return row.name ? row : null;
  }).filter(Boolean);
  const checkin = plainText(times.checkin_start || policy.checkIn?.from);
  const checkinEnd = plainText(times.checkin_end || policy.checkIn?.until);
  const checkout = plainText(times.checkout || policy.checkOut?.until);
  const row = {
    hotelId: String(source.id || ""),
    name: plainText(source.name).slice(0, 160),
    description: plainText(source.hotelDescription).slice(0, 1200),
    important: plainText(source.hotelImportantInformation).slice(0, 1200),
    address: plainText(source.address),
    city: plainText(source.city),
    photos: photoEntries(source.hotelImages, 16),
    facilities: nameList(source.facilities?.length ? source.facilities : source.hotelFacilities, 24),
    categories,
    pros: nameList(source.sentiment_analysis?.pros, 4),
    cons: nameList(source.sentiment_analysis?.cons, 4),
    reviews: reviewList,
    rooms,
  };
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    row.latitude = latitude;
    row.longitude = longitude;
  }
  if (Number.isFinite(rating) && rating > 0) row.rating = rating;
  if (Number.isFinite(reviewCount) && reviewCount > 0) row.reviewCount = reviewCount;
  if (checkin) row.checkin = checkinEnd ? `${checkin}–${checkinEnd}` : checkin;
  if (checkout) row.checkout = checkout;
  if (children != null) row.childrenAllowed = children;
  if (pets != null) row.petsAllowed = pets;
  const parking = parkingText(source.parking);
  if (parking) row.parking = parking;
  return row.name ? row : null;
}

export async function hotelProfile(hotelId) {
  const [detail, reviews] = await Promise.all([
    nuitee(`/data/hotel?hotelId=${encodeURIComponent(hotelId)}`, {
      timeout: 20000,
      fallback: "The hotel partner could not load this hotel.",
    }),
    nuitee(`/data/reviews?hotelId=${encodeURIComponent(hotelId)}&limit=6&getSentiment=false`, {
      timeout: 20000,
      fallback: "Reviews did not load.",
    }).catch(() => null),
  ]);
  const hotel = presentHotel(detail, reviews);
  if (!hotel) {
    const err = new Error("The hotel partner did not send this hotel.");
    err.status = 502;
    throw err;
  }
  return hotel;
}

export async function prebookHotel(offerId) {
  const data = await nuitee("/rates/prebook", {
    method: "POST",
    timeout: 120000,
    timeoutMessage: "The hotel is still checking this room. Try again. Nothing was charged.",
    fallback: "The hotel partner could not hold this room.",
    body: { offerId, usePaymentSdk: true },
  });
  const bag = Array.isArray(data?.data) ? data.data[0] || {} : data?.data || data || {};
  return {
    prebookId: String(bag.prebookId || ""),
    transactionId: String(bag.transactionId || ""),
    secretKey: String(bag.secretKey || ""),
    total: money(bag.price),
    currency: String(bag.currency || ""),
    sandbox: nuiteeSandbox(),
  };
}

function readBooked(data, sent) {
  const bag = data?.data || data || {};
  const hotel = bag.hotel || {};
  const price = amountOf(bag.price) || amountOf(bag.bookedRate) || { total: money(bag.price), currency: bag.currency || "" };
  return {
    bookingId: String(bag.bookingId || bag.id || ""),
    status: String(bag.status || ""),
    confirmation: String(bag.hotelConfirmationCode || bag.confirmationCode || ""),
    name: String(hotel.name || sent.name || "").trim(),
    city: String(hotel.city || sent.city || "").trim(),
    checkin: String(bag.checkin || sent.checkin || "").slice(0, 10),
    checkout: String(bag.checkout || sent.checkout || "").slice(0, 10),
    room: String(bag.roomName || sent.room || "").trim(),
    total: price?.total ?? (Number(sent.total) || null),
    currency: price?.currency || sent.currency || "",
    sandbox: nuiteeSandbox(),
  };
}

export async function bookHotel({ prebookId, transactionId, guest, stay }) {
  const holder = {
    firstName: String(guest.firstName || "").trim(),
    lastName: String(guest.lastName || "").trim(),
    email: String(guest.email || "").trim(),
  };
  const data = await nuitee("/rates/book", {
    method: "POST",
    timeout: 120000,
    timeoutMessage: "The hotel is still confirming the room. Check Stays before paying again.",
    fallback: "The hotel partner could not confirm this stay.",
    body: {
      prebookId,
      clientReference: `SH-${Date.now().toString(36)}`,
      holder,
      guests: [{ occupancyNumber: 1, ...holder }],
      payment: { method: "TRANSACTION_ID", transactionId },
    },
  });
  return readBooked(data, stay || {});
}
