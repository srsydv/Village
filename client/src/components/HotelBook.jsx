import { useEffect, useRef, useState } from "react";
import { bookLiveHotel, hotelProfile, hotelRooms, hotelStatus, listStays, prebookLiveHotel, searchLiveHotels } from "../lib/api.js";
import { beginLocationRequest } from "../lib/region.js";
import { useTravel } from "../lib/TravelContext.jsx";
import "./site/try.css";

function localToday(offset = 0) {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  const pad = (value) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

function nightsBetween(start, end) {
  const from = new Date(`${start}T12:00:00`);
  const to = new Date(`${end}T12:00:00`);
  const nights = Math.round((to - from) / 86400000);
  return nights > 0 ? nights : 1;
}

function nightly(row, nights) {
  const total = Number(row.total);
  if (!Number.isFinite(total) || !nights) return "";
  const each = money(total / nights, row.currency);
  return each ? `${each} per night` : "";
}

function countryCode(nationality) {
  const text = String(nationality || "India").toLowerCase();
  if (text === "india" || text.startsWith("in")) return "IN";
  if (text.length === 2) return text.toUpperCase();
  return "IN";
}

function money(amount, currency = "INR") {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency || ""} ${amount}`.trim();
  }
}

function when(iso) {
  if (!iso) return "";
  const day = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(day.getTime())) return iso;
  return day.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function cancelWhen(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const day = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(day.getTime())) return raw;
  return day.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function refundText(row) {
  if (row.refundable == null) return "";
  const fee = row.cancelFee != null ? money(row.cancelFee, row.cancelCurrency) : "";
  const at = cancelWhen(row.cancelAt);
  if (row.refundable && row.cancelFee === 0 && at) return `Free cancellation until ${at}`;
  if (row.refundable && fee && at) return `Refundable · fee ${fee} from ${at}`;
  if (row.refundable) return "Refundable";
  return "Non-refundable";
}

function facts(row) {
  return [
    Number(row.stars) > 0 ? `${row.stars}-star` : "",
    row.rating ? `Rating ${row.rating}` : "",
    row.reviews ? `${row.reviews} reviews` : "",
  ].filter(Boolean).join(" · ");
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The booking partner’s payment form did not load. Nothing was charged."));
    document.head.appendChild(script);
  });
}

let issueTask = null;

function startStayIssue() {
  if (issueTask) return issueTask;
  const url = new URL(window.location.href);
  if (url.searchParams.get("hotelPaid") !== "1") return null;
  const raw = sessionStorage.getItem("safar.pendingStay");
  if (!raw) return null;
  let pending;
  try {
    pending = JSON.parse(raw);
  } catch {
    return null;
  }
  issueTask = bookLiveHotel(pending)
    .then((stay) => {
      sessionStorage.removeItem("safar.pendingStay");
      url.searchParams.delete("hotelPaid");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
      return stay;
    })
    .catch((err) => {
      issueTask = null;
      throw err;
    });
  return issueTask;
}

export function HotelIssue({ variant = "web", onTickets = null }) {
  const [phase, setPhase] = useState("idle");
  const [stay, setStay] = useState(null);
  const [error, setError] = useState("");
  const web = variant === "web";
  const box = useRef(null);

  useEffect(() => {
    const task = startStayIssue();
    if (!task) return undefined;
    setPhase("issuing");
    let cancel = false;
    task
      .then((booked) => {
        if (cancel) return;
        setStay(booked);
        setPhase("done");
        window.dispatchEvent(new CustomEvent("safar-stay", { detail: booked }));
      })
      .catch((err) => {
        if (cancel) return;
        setError(err.message || "The hotel is still confirming the room. Check Stays before paying again.");
        setPhase("error");
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (phase === "idle") return;
    box.current?.scrollIntoView({ block: "start" });
  }, [phase]);

  if (phase === "idle") return null;
  const doneLine = stay
    ? [stay.name, stay.status, stay.confirmation ? `Hotel code ${stay.confirmation}` : "", stay.sandbox ? "This is a test booking." : ""].filter(Boolean).join(" · ")
    : "";
  return (
    <section ref={box} className={web ? `web-issue is-${phase}` : "mx-4 mt-4 rounded-2xl border border-[var(--line)] px-4 py-4"}>
      {phase === "issuing" ? (
        <>
          <p>Payment received. Confirming your room.</p>
          <p className={web ? "web-note" : "mt-1 text-xs text-[var(--muted)]"}>
            Stay on this page. You don’t need to pay again.
          </p>
        </>
      ) : null}
      {phase === "done" && stay ? (
        <>
          <p>Booking is done.</p>
          <p className={web ? "web-note" : "mt-1 text-xs text-[var(--muted)]"}>{doneLine}</p>
          {onTickets ? <button type="button" className="stay-book" onClick={onTickets}>Go to tickets</button> : null}
        </>
      ) : null}
      {phase === "error" ? <p className={web ? "web-error" : "text-sm text-[var(--rose)]"}>{error}</p> : null}
    </section>
  );
}

function HotelMark() {
  return (
    <span className="web-stay-mark" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path d="M8 40V18L24 8l16 10v22" />
        <path d="M8 40h32" />
        <path d="M20 40v-7h8v7" />
        <rect className="web-stay-window" x="15" y="20" width="6" height="5" rx="0.6" />
        <rect className="web-stay-window is-2" x="27" y="20" width="6" height="5" rx="0.6" />
        <rect className="web-stay-window is-3" x="15" y="28" width="6" height="5" rx="0.6" />
        <rect className="web-stay-window is-4" x="27" y="28" width="6" height="5" rx="0.6" />
      </svg>
    </span>
  );
}

function stayNights(start, end) {
  const from = new Date(`${String(start || "").slice(0, 10)}T12:00:00`);
  const to = new Date(`${String(end || "").slice(0, 10)}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const nights = Math.round((to - from) / 86400000);
  return nights > 0 ? nights : 0;
}

export function StayList() {
  const [stays, setStays] = useState(null);

  useEffect(() => {
    let cancel = false;
    function load() {
      listStays().then((rows) => {
        if (!cancel) setStays(rows);
      }).catch(() => {
        if (!cancel) setStays([]);
      });
    }
    load();
    window.addEventListener("safar-stay", load);
    return () => {
      cancel = true;
      window.removeEventListener("safar-stay", load);
    };
  }, []);

  if (!stays?.length) return null;
  return (
    <div className="web-stays">
      <p className="web-kicker">Stays</p>
      {stays.map((stay) => {
        const confirmed = String(stay.status || "").toUpperCase() === "CONFIRMED";
        const cancelled = String(stay.status || "").toUpperCase().includes("CANCEL");
        const nights = stayNights(stay.checkin, stay.checkout);
        return (
          <article key={stay.bookingId || stay.bookedAt} className="web-ticket-card">
            <div className="web-ticket-card-head">
              <p className="web-ticket-chip">{stay.sandbox ? "Test booking" : "Stay"}</p>
              <p className={`web-ticket-pill ${cancelled ? "is-cancelled" : confirmed ? "is-confirmed" : "is-pending"}`}>{stay.status ? stay.status.charAt(0) + stay.status.slice(1).toLowerCase() : "Saved"}</p>
            </div>
            <header className="web-stay-ticket-head">
              <HotelMark />
              <div>
                <h2>{stay.name || "Hotel"}</h2>
                {stay.city ? <p>{stay.city}</p> : null}
              </div>
              {stay.total != null ? <strong className="web-stay-ticket-price">{money(stay.total, stay.currency)}</strong> : null}
            </header>
            {stay.checkin || stay.checkout ? (
              <div className="web-stay-ticket-when">
                <div>
                  <span>Check-in</span>
                  <strong>{when(stay.checkin) || "—"}</strong>
                </div>
                <div className="web-stay-ticket-span" aria-hidden="true">
                  <i />
                  {nights ? <em>{nights} night{nights === 1 ? "" : "s"}</em> : null}
                </div>
                <div>
                  <span>Check-out</span>
                  <strong>{when(stay.checkout) || "—"}</strong>
                </div>
              </div>
            ) : null}
            {stay.room ? <p className="web-stay-ticket-room">{stay.room}</p> : null}
            {stay.confirmation || stay.bookingId ? (
              <p className="web-ticket-foot">
                <span>{stay.confirmation ? "Hotel code" : "Reference"}</span>
                <strong>{stay.confirmation || stay.bookingId}</strong>
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function staySpan(start, end) {
  const from = new Date(`${start}T12:00:00`);
  const to = new Date(`${end}T12:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "";
  const left = from.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const right = to.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${left}–${right}`;
}

function roomKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchRoom(rooms, rateName) {
  const needle = roomKey(rateName);
  if (!needle || !Array.isArray(rooms)) return null;
  return rooms.find((room) => roomKey(room.name) === needle)
    || rooms.find((room) => {
      const hay = roomKey(room.name);
      return hay && (hay.includes(needle) || needle.includes(hay));
    })
    || null;
}

function scoreText(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "";
  return String(Math.round(score * 10) / 10);
}

function reviewDate(value) {
  const day = new Date(`${String(value || "").slice(0, 10)}T12:00:00`);
  if (Number.isNaN(day.getTime())) return "";
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function galleryOf(detail, picked) {
  if (detail?.photos?.length) return detail.photos;
  const urls = Array.isArray(picked?.photos) && picked.photos.length ? picked.photos : (picked?.photo ? [picked.photo] : []);
  return urls.filter(Boolean).map((url) => (typeof url === "string" ? { url } : url));
}

function mapEmbed(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const pad = 0.012;
  const bbox = [lng - pad, lat - pad, lng + pad, lat + pad].map((value) => value.toFixed(5)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function placeLabel(value) {
  return String(value || "").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function stayQuestions(stay) {
  const name = stay?.name || "this hotel";
  const place = placeLabel(stay?.city);
  return [
    place ? `Which hotel in ${place} is best for one night?` : "",
    `What should I know before staying at ${name}?`,
    place ? `How do I get to ${name} in ${place}?` : `How do I get to ${name}?`,
  ].filter(Boolean);
}

function StepCheck() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M3.2 8.2 6.3 11.3 12.8 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepPerson() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="5" r="2.2" fill="currentColor" />
      <path d="M3.2 13.1c.7-2.3 2.4-3.4 4.8-3.4s4.1 1.1 4.8 3.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StayPin() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M8 1.8a4.2 4.2 0 0 0-4.2 4.2c0 3.1 4.2 8.2 4.2 8.2s4.2-5.1 4.2-8.2A4.2 4.2 0 0 0 8 1.8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="6" r="1.3" fill="currentColor" />
    </svg>
  );
}

function StayChange() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="2.2" y="3.2" width="11.6" height="10.2" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.2 6.2h11.6M6.2 2.2v2M9.8 2.2v2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StayBed() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M2 12.5V4.5M2 8.5h12v4M6.2 8.5V7a1.2 1.2 0 0 1 1.2-1.2h5.1A1.2 1.2 0 0 1 13.7 7v1.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WatchMark() {
  return (
    <svg className="stay-watch-mark" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4S1.5 8 1.5 8z" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}

function StayGallery({ photos, onClose, onOpen }) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const at = count ? ((index % count) + count) % count : 0;
  const photo = photos[at];
  return (
    <div className="stay-gallery">
      <button type="button" className="stay-gallery-open" onClick={() => photo?.url && onOpen?.(at)} aria-label="View this photo larger">
        {photo?.url ? <img src={photo.url} alt={photo.caption || ""} /> : <span className="stay-photo-empty" />}
      </button>
      <div className="stay-gallery-bar">
        {count > 1 ? <span className="stay-gallery-count">{at + 1} of {count}</span> : <span />}
        <button type="button" className="stay-gallery-close" onClick={onClose}>Close</button>
      </div>
      {count > 1 ? (
        <>
          <button type="button" className="stay-gallery-nav is-prev" aria-label="Previous photo" onClick={() => setIndex(at - 1)}>‹</button>
          <button type="button" className="stay-gallery-nav is-next" aria-label="Next photo" onClick={() => setIndex(at + 1)}>›</button>
        </>
      ) : null}
    </div>
  );
}

function RoomShots({ photos, onOpen }) {
  if (!photos?.length) return null;
  const frames = photos.map((url) => ({ url }));
  return (
    <div className="stay-room-photos">
      {photos.map((url, index) => (
        <button key={`${url}-${index}`} type="button" className="stay-shot" onClick={() => onOpen?.(frames, index)} aria-label="View room photo">
          <img src={url} alt="" />
        </button>
      ))}
    </div>
  );
}

function RoomCopy({ text }) {
  const parts = String(text || "").split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return <p className="stay-copy">{text}</p>;
  return (
    <ul className="stay-points">
      {parts.map((part, index) => <li key={`${index}-${part}`}>{part}</li>)}
    </ul>
  );
}

function PhotoViewer({ photos, start = 0, onClose }) {
  const [index, setIndex] = useState(start);
  const count = photos.length;
  const at = count ? ((index % count) + count) % count : 0;
  const photo = photos[at];
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setIndex((current) => current + 1);
      if (event.key === "ArrowLeft") setIndex((current) => current - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  if (!photo?.url) return null;
  return (
    <div className="stay-lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      <button type="button" className="stay-lightbox-close" onClick={onClose}>Close</button>
      {count > 1 ? <button type="button" className="stay-lightbox-nav is-prev" aria-label="Previous photo" onClick={(event) => { event.stopPropagation(); setIndex(at - 1); }}>‹</button> : null}
      <figure onClick={(event) => event.stopPropagation()}>
        <img src={photo.url} alt={photo.caption || ""} />
        <figcaption>{[count > 1 ? `${at + 1} of ${count}` : "", photo.caption || ""].filter(Boolean).join(" · ")}</figcaption>
      </figure>
      {count > 1 ? <button type="button" className="stay-lightbox-nav is-next" aria-label="Next photo" onClick={(event) => { event.stopPropagation(); setIndex(at + 1); }}>›</button> : null}
    </div>
  );
}

function ShortlistPane({ stays = [], onOpen, onRemove, onAsk }) {
  const lead = stays[0];
  return (
    <div>
      <p className="stay-side-kicker">{stays.length ? `Stays ${stays.length}` : "Stays"}</p>
      {stays.length ? (
        <ul className="stay-side-list">
          {stays.map((stay) => (
            <li key={stay.hotelId} className="stay-side-item">
              <button type="button" className="stay-side-open" onClick={() => onOpen?.(stay)}>
                {stay.photo ? <img src={stay.photo} alt="" /> : <span className="stay-photo-empty" />}
                <span className="stay-side-copy">
                  <span className="stay-side-top">
                    <strong>{stay.name}</strong>
                    {stay.nightly ? <em>{stay.nightly}</em> : <em>No live price</em>}
                  </span>
                  {stay.rating ? <small>{stay.rating}{stay.reviews ? ` (${stay.reviews})` : ""}{stay.city ? ` · ${placeLabel(stay.city)}` : ""}</small> : stay.city ? <small>{placeLabel(stay.city)}</small> : null}
                  {stay.when ? <small>{stay.when}</small> : null}
                  {stay.nightly ? <small className="stay-watch"><WatchMark /> Watching price</small> : null}
                </span>
              </button>
              <button type="button" className="stay-side-x" onClick={() => onRemove?.(stay)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : <p className="stay-rail-empty">Nothing shortlisted yet.</p>}
      {lead ? (
        <>
          <p className="stay-side-kicker">Add to this trip</p>
          <div className="stay-asks">
            {stayQuestions(lead).map((prompt) => (
              <button key={prompt} type="button" className="stay-ask" onClick={() => onAsk?.(prompt)}>
                <span>{prompt}</span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!document.querySelector("link[data-safar-leaflet]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.dataset.safarLeaflet = "1";
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-safar-leaflet]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("The map did not load.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.dataset.safarLeaflet = "1";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("The map did not load."));
    document.body.appendChild(script);
  });
}

export function StayMap({ place, onClose, embedded = false }) {
  const node = useRef(null);
  const mapRef = useRef(null);
  const routeRef = useRef(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(null);

  useEffect(() => {
    let map;
    let cancel = false;
    loadLeaflet().then((L) => {
      if (cancel || !node.current || !L) return;
      map = L.map(node.current, { zoomControl: true }).setView([place.latitude, place.longitude], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      L.circleMarker([place.latitude, place.longitude], {
        radius: 8,
        color: "#171512",
        weight: 2,
        fillColor: "#9a7340",
        fillOpacity: 1,
      }).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 250);
    }).catch((err) => {
      if (!cancel) setError(err.message || "The map did not load.");
    });
    return () => {
      cancel = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [place.latitude, place.longitude]);

  async function directions() {
    setBusy(true);
    setError("");
    try {
      const here = from || await beginLocationRequest();
      setFrom(here);
      const L = window.L;
      const map = mapRef.current;
      if (!L || !map) return;
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${here.longitude},${here.latitude};${place.longitude},${place.latitude}?overview=full&geometries=geojson`);
      const data = await res.json();
      const route = data?.routes?.[0];
      if (!route?.geometry) throw new Error("No driving route came back.");
      if (routeRef.current) map.removeLayer(routeRef.current);
      const line = L.geoJSON(route.geometry, { style: { color: "#2457d6", weight: 5 } }).addTo(map);
      routeRef.current = line;
      L.circleMarker([here.latitude, here.longitude], {
        radius: 6,
        color: "#fff",
        weight: 2,
        fillColor: "#2457d6",
        fillOpacity: 1,
      }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [28, 28] });
      const km = Math.round((Number(route.distance) / 1000) * 10) / 10;
      const minutes = Math.round(Number(route.duration) / 60);
      setNote(Number.isFinite(km) && Number.isFinite(minutes) ? `${km} km · ${minutes} min by car` : "");
    } catch (err) {
      setError(err?.message || "Directions did not load.");
    } finally {
      setBusy(false);
    }
  }

  const directionsUrl = from
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from.latitude}%2C${from.longitude}%3B${place.latitude}%2C${place.longitude}`
    : `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${place.latitude}%2C${place.longitude}`;

  const body = (
    <>
      {embedded ? (
        <div className="stay-map-head">
          <div>
            <strong>{place.name}</strong>
            {place.address ? <p>{place.address}</p> : null}
          </div>
        </div>
      ) : (
        <header className="stay-map-head">
          <div>
            <strong>{place.name}</strong>
            {place.address ? <p>{place.address}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close map">×</button>
        </header>
      )}
      <div ref={node} className="stay-map-canvas" />
      <footer className="stay-map-foot">
        <button type="button" className="stay-book" onClick={directions} disabled={busy}>{busy ? "Finding the route…" : "Directions from here"}</button>
        {note ? <p>{note}</p> : null}
        {error ? <p className="web-error">{error}</p> : null}
        <a href={directionsUrl} target="_blank" rel="noreferrer">Open directions</a>
      </footer>
    </>
  );
  if (embedded) return <div className="stay-map-panel is-embedded">{body}</div>;
  return <aside className="stay-side stay-map-panel" aria-label="Map">{body}</aside>;
}

const RAIL_TABS = [
  ["shortlisted", "Shortlisted"],
  ["plan", "Day Plan"],
  ["map", "Map"],
  ["bookings", "Bookings"],
];

function parseDay(value) {
  const day = new Date(`${String(value || "").slice(0, 10)}T12:00:00`);
  return Number.isNaN(day.getTime()) ? null : day;
}

function isoDay(day) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

function eachDay(start, end) {
  const from = parseDay(start);
  const to = parseDay(end);
  if (!from || !to || to < from) return [];
  const days = [];
  for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    days.push(new Date(cursor));
  }
  return days;
}

function planDays(stays, range) {
  const ranges = (stays || []).map((stay) => ({
    start: parseDay(stay.checkin),
    end: parseDay(stay.checkout),
    stay,
  })).filter((item) => item.start && item.end);
  const bounds = [
    ...ranges.flatMap((item) => [item.start, item.end]),
    parseDay(range?.checkin),
    parseDay(range?.checkout),
  ].filter(Boolean);
  if (!bounds.length) return [];
  const start = new Date(Math.min(...bounds.map((day) => day.getTime())));
  const end = new Date(Math.max(...bounds.map((day) => day.getTime())));
  return eachDay(isoDay(start), isoDay(end)).map((day) => ({
    day,
    key: isoDay(day),
    staying: ranges.filter((item) => isoDay(item.start) === isoDay(day)).map((item) => item.stay),
  }));
}

function nightLine(stay) {
  const out = parseDay(stay.checkout);
  const nights = Number(stay.nights);
  const night = Number.isFinite(nights) && nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "";
  const leave = out ? `out ${out.toLocaleDateString("en-US", { weekday: "short" })}` : "";
  return [night, leave].filter(Boolean).join(" · ");
}

function planPrompt(day, place) {
  const when = day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return place ? `Plan ${when} in ${placeLabel(place)}` : `Plan ${when}`;
}

function DayPlan({ stays, place, range, onOpen, onAsk }) {
  const days = planDays(stays, range);
  const dayKey = days.map((item) => item.key).join(",");
  const [selected, setSelected] = useState(days[0]?.key || "");
  useEffect(() => {
    const keys = dayKey ? dayKey.split(",") : [];
    setSelected((current) => (current && keys.includes(current) ? current : keys[0] || ""));
  }, [dayKey]);

  if (!days.length) {
    return (
      <div className="stay-plan">
        <p className="stay-plan-title">Your plan</p>
        <p className="stay-rail-empty">Nothing planned yet.</p>
        <button type="button" className="stay-plan-add" onClick={() => onAsk?.(place ? `Plan a day in ${placeLabel(place)}` : "Plan a day")}>+ Add to the plan</button>
      </div>
    );
  }

  return (
    <div className="stay-plan">
      <p className="stay-plan-title">Your plan</p>
      <p className="stay-plan-count">{days.length} day{days.length === 1 ? "" : "s"}</p>
      <div className="stay-plan-days">
        {days.map((item) => (
          <button key={item.key} type="button" className={item.key === selected ? "stay-plan-day is-on" : "stay-plan-day"} onClick={() => setSelected(item.key)}>
            <small>{item.day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</small>
            <strong>{item.day.getDate()}</strong>
          </button>
        ))}
      </div>
      {days.map((item, index) => (
        <section key={item.key} className="stay-plan-block">
          <div className="stay-plan-row">
            <strong>{item.day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</strong>
            <div className="stay-plan-meta">
              {index === 0 && place ? <span>{placeLabel(place)}</span> : null}
              <button type="button" className="stay-plan-plus" aria-label={`Add to ${item.day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`} onClick={() => onAsk?.(planPrompt(item.day, place))}>+</button>
            </div>
          </div>
          {item.staying.length ? <p className="stay-plan-note">No time yet</p> : (
            <div className="stay-plan-empty">
              <p className="stay-plan-note">Nothing planned yet</p>
              <button type="button" className="stay-plan-add" onClick={() => onAsk?.(planPrompt(item.day, place))}>+ Add to the plan</button>
            </div>
          )}
          {item.staying.map((stay) => (
            <button key={stay.hotelId} type="button" className="stay-side-open stay-plan-stay" onClick={() => onOpen?.(stay)}>
              {stay.photo ? <img src={stay.photo} alt="" /> : <span className="stay-photo-empty" />}
              <span className="stay-side-copy">
                <strong>{stay.name}</strong>
                {nightLine(stay) ? <small>{nightLine(stay)}</small> : null}
                {stay.nightly ? <small className="stay-watch"><WatchMark /> Watching price</small> : null}
              </span>
            </button>
          ))}
        </section>
      ))}
      <button type="button" className="stay-plan-add" onClick={() => onAsk?.(place ? `Add something to the ${placeLabel(place)} plan` : "Add something to this plan")}>+ Add to the plan</button>
    </div>
  );
}

function StayBookings({ place }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    listStays().then((list) => {
      if (cancel) return;
      const city = String(place || "").trim().toLowerCase();
      setRows(city ? list.filter((stay) => String(stay.city || "").toLowerCase().includes(city)) : list);
    }).catch((err) => {
      if (!cancel) setError(err?.message || "Bookings did not load.");
    });
    return () => {
      cancel = true;
    };
  }, [place]);

  if (error) return <p className="web-error">{error}</p>;
  if (!rows) return <p className="stay-rail-empty">Loading bookings…</p>;
  if (!rows.length) return <p className="stay-rail-empty">No bookings yet.</p>;
  return (
    <ul className="stay-side-list">
      {rows.map((stay) => (
        <li key={stay.bookingId || `${stay.name}-${stay.checkin}`} className="stay-booked">
          <strong>{stay.name || "Hotel"}</strong>
          <small>{[staySpan(stay.checkin, stay.checkout), stay.city ? placeLabel(stay.city) : ""].filter(Boolean).join(" · ")}</small>
          {stay.room ? <small>{stay.room}</small> : null}
          <small>
            {[
              stay.confirmation ? `Hotel code ${stay.confirmation}` : stay.bookingId ? `Reference ${stay.bookingId}` : "",
              stay.total != null ? money(stay.total, stay.currency) : "",
              stay.sandbox ? "Test booking" : "",
            ].filter(Boolean).join(" · ")}
          </small>
        </li>
      ))}
    </ul>
  );
}

export function StayRail({ place = "", stays = [], range = null, mapPlace = null, tab = "shortlisted", onTab, onOpen, onRemove, onAsk }) {
  const title = placeLabel(place);
  return (
    <aside className={tab === "map" ? "stay-side stay-trip is-map" : "stay-side stay-trip"} aria-label="Trip">
      {title ? <h2 className="stay-rail-place">{title}</h2> : null}
      <div className="stay-rail-tabs" role="tablist">
        {RAIL_TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => onTab?.(id)}>{label}</button>
        ))}
      </div>
      <div className="stay-rail-body">
        {tab === "shortlisted" ? <ShortlistPane stays={stays} onOpen={onOpen} onRemove={onRemove} onAsk={onAsk} /> : null}
        {tab === "plan" ? <DayPlan stays={stays} place={place} range={range} onOpen={onOpen} onAsk={onAsk} /> : null}
        {tab === "map" ? (mapPlace ? <StayMap place={mapPlace} embedded /> : <p className="stay-rail-empty">Open a hotel map to see it here.</p>) : null}
        {tab === "bookings" ? <StayBookings place={place} /> : null}
      </div>
    </aside>
  );
}

function nightPrice(row, nights) {
  const total = Number(row.total);
  if (!Number.isFinite(total)) return "";
  return money(nights > 0 ? total / nights : total, row.currency);
}

function groupRooms(rows) {
  const groups = [];
  for (const row of rows || []) {
    const name = row.room || "Room";
    let group = groups.find((item) => item.name === name);
    if (!group) {
      group = { name, rates: [], photos: row.photos?.length ? row.photos : (row.photo ? [row.photo] : []) };
      groups.push(group);
    }
    group.rates.push(row);
  }
  return groups;
}

function DetailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 10.6v5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function AskIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M7.2 17.2 5.4 19.6c-.35.45.03 1.1.6 1.02l3.2-.42c.92.35 1.9.54 2.9.54a7.1 7.1 0 1 0-7.1-7.1c0 1.4.4 2.7 1.1 3.8z" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      <path d="M9.2 11.1h5.8M9.2 14h3.8" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
    </svg>
  );
}

function ShortlistIcon({ on = false }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M7.2 4.6h9.6c.55 0 1 .45 1 1v13.1c0 .55-.6.9-1.08.62L12 16.1 7.28 19.3c-.48.28-1.08-.07-1.08-.62V5.6c0-.55.45-1 1-1z"
        fill={on ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StayCard({ row, nights, badge, saved, onOpen, onAsk, onSave }) {
  const price = nightPrice(row, nights);
  const meta = [
    Number(row.stars) > 0 ? `${row.stars}-star hotel` : "",
    row.city || "",
    row.refundable == null ? "" : row.refundable ? "Refundable" : "Non-refundable",
    row.distanceKm != null ? `${row.distanceKm} km` : "",
  ].filter(Boolean).join(" · ");
  return (
    <article className="stay-card">
      <button type="button" className="stay-photo" onClick={() => onOpen(row)}>
        {row.photo ? <img src={row.photo} alt="" /> : <span className="stay-photo-empty" />}
        {badge || row.rating ? (
          <span className="stay-badge">
            {badge ? <em>{badge}</em> : null}
            {row.rating ? <strong>{row.rating}{row.reviews ? ` (${row.reviews})` : ""}</strong> : null}
          </span>
        ) : null}
      </button>
      <div className="stay-card-body">
        <p className="stay-name">{row.name}</p>
        {price ? <p className="stay-price">{price} <span>/ night</span></p> : <p className="stay-price is-quiet">No live price</p>}
        {meta ? <p className="stay-meta">{meta}</p> : null}
        <div className="stay-actions">
          <div className="stay-action-links">
            <button type="button" className="stay-tool" onClick={() => onOpen(row)}>
              <DetailIcon />
              <span>Detail</span>
            </button>
            <button type="button" className="stay-tool" onClick={() => onAsk?.(row)}>
              <AskIcon />
              <span>Ask Safar</span>
            </button>
            <button type="button" className={saved ? "stay-tool is-on" : "stay-tool"} onClick={() => onSave(row)}>
              <ShortlistIcon on={saved} />
              <span>{saved ? "Shortlisted" : "Shortlist"}</span>
            </button>
          </div>
          <button type="button" className="stay-book" onClick={() => onOpen(row)}>
            {price ? <strong>{price}</strong> : null}
            <span>{price ? "Book from" : "Book"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

export function HotelBook({ city = "", nearby = false, placePromise = null, onAsk = null, saved = [], onSave = null, openStay = null, onOpened = null, onShowMap = null, onRange = null }) {
  const { profile, account } = useTravel();
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState(nearby ? "nearby" : "city");
  const [step, setStep] = useState(nearby ? "location" : "details");
  const [here, setHere] = useState(null);
  const [checkin, setCheckin] = useState(localToday(1));
  const [checkout, setCheckout] = useState(localToday(2));
  const [adults, setAdults] = useState(2);
  const [budget, setBudget] = useState("");
  const [distance, setDistance] = useState("10");
  const [sheet, setSheet] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const railRef = useRef(null);
  const [where, setWhere] = useState(city);
  const [cityDraft, setCityDraft] = useState(city);
  const [hotels, setHotels] = useState(null);
  const [picked, setPicked] = useState(null);
  const [detail, setDetail] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [guest, setGuest] = useState({ firstName: "", lastName: "", email: "" });
  const [editingGuest, setEditingGuest] = useState(false);
  const [otherGuest, setOtherGuest] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const pricedFor = useRef(2);
  const [chosen, setChosen] = useState(null);
  const [held, setHeld] = useState(null);
  const payRef = useRef(null);
  const payToken = useRef(0);
  const openedId = useRef("");
  const openToken = useRef(0);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const country = countryCode(profile?.nationality);

  useEffect(() => {
    onRange?.({ checkin, checkout, city: where || city });
  }, [checkin, checkout, where, city]);

  useEffect(() => {
    setWhere(city);
    setCityDraft(city);
    setHere(null);
    setHotels(null);
    setPicked(null);
    setDetail(null);
    setChosen(null);
    setHeld(null);
    if (nearby) {
      setMode("nearby");
      setStep("location");
    } else {
      setMode("city");
      setStep("details");
    }
  }, [city, nearby]);

  useEffect(() => {
    if (!nearby || !placePromise) return undefined;
    let cancel = false;
    setBusy(true);
    setError("");
    setNote("Waiting for location…");
    placePromise
      .then((position) => {
        if (cancel) return;
        setHere(position);
        setNote("");
        setStep("details");
      })
      .catch((err) => {
        if (cancel) return;
        setNote("");
        setError(locationError(err));
        setStep("location");
      })
      .finally(() => {
        if (!cancel) setBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [nearby, placePromise]);

  useEffect(() => {
    const parts = String(profile?.name || "").trim().split(/\s+/);
    setGuest((current) => ({
      firstName: current.firstName || parts[0] || "",
      lastName: current.lastName || parts.slice(1).join(" "),
      email: current.email || account?.email || "",
    }));
  }, [profile?.name, account?.email]);

  useEffect(() => {
    let cancel = false;
    hotelStatus().then((next) => {
      if (!cancel) setStatus(next);
    }).catch(() => {
      if (!cancel) setStatus({ enabled: false, sandbox: false });
    });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!held?.secretKey) return undefined;
    const node = payRef.current;
    if (!node) return undefined;
    const token = payToken.current + 1;
    payToken.current = token;
    node.replaceChildren();
    let cancel = false;
    const pending = {
      prebookId: held.prebookId,
      transactionId: held.transactionId,
      guest: held.guest || guest,
      stay: {
        name: held.hotelName || "",
        city: held.hotelCity || "",
        checkin: held.checkin,
        checkout: held.checkout,
        room: held.room || "",
        total: held.total,
        currency: held.currency || "",
      },
    };
    sessionStorage.setItem("safar.pendingStay", JSON.stringify(pending));
    loadScript("https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1")
      .then(() => {
        if (cancel || token !== payToken.current) return;
        if (!window.LiteAPIPayment) {
          setError("The booking partner’s payment form did not open. Nothing was charged.");
          return;
        }
        node.replaceChildren();
        const url = new URL(window.location.href);
        url.searchParams.set("hotelPaid", "1");
        const lite = new window.LiteAPIPayment({
          publicKey: status?.sandbox ? "sandbox" : "live",
          appearance: { theme: "flat" },
          options: { business: { name: "Safar" } },
          targetElement: "#safar-hotel-pay",
          secretKey: held.secretKey,
          returnUrl: url.toString(),
        });
        lite.handlePayment();
      })
      .catch((err) => {
        if (!cancel && token === payToken.current) setError(err.message);
      });
    return () => {
      cancel = true;
      if (token === payToken.current) node.replaceChildren();
    };
  }, [held?.secretKey, held?.prebookId, status?.sandbox]);

  useEffect(() => {
    const id = openStay?.hotelId || "";
    if (!id) {
      openedId.current = "";
      return undefined;
    }
    if (openedId.current === id) return undefined;
    openedId.current = id;
    openHotel(openStay);
    onOpened?.();
  }, [openStay?.hotelId]);

  useEffect(() => {
    if (mode === "nearby" && !here) return undefined;
    if (mode !== "nearby" && !String(where || city || "").trim()) return undefined;
    const km = Number(distance);
    if (mode === "nearby" && !(km >= 1 && km <= 50)) return undefined;
    search();
  }, [mode, where, city, here, checkin, checkout, adults, distance]);

  function locationError(err) {
    const denied = err?.code === 1 || /denied|permission|not allowed/i.test(String(err?.message || ""));
    if (denied) {
      return "Location is blocked. In the browser, click the lock icon beside the address and set Location to Allow. In the app, allow Location for Safar in Settings. Or search by city.";
    }
    return err?.message || "Safar could not read this location.";
  }

  async function allowLocation() {
    setError("");
    setBusy(true);
    setNote("Waiting for location…");
    try {
      const position = await beginLocationRequest();
      setHere(position);
      setNote("");
      setStep("details");
    } catch (err) {
      setNote("");
      setError(locationError(err));
    } finally {
      setBusy(false);
    }
  }

  function chooseMode(next) {
    setMode(next);
    setError("");
    setHotels(null);
    setPicked(null);
    setChosen(null);
    setHeld(null);
    if (next === "nearby" && !here) setStep("location");
    else setStep("details");
  }

  function chosenDistance() {
    const km = Number(distance);
    return Number.isFinite(km) ? km : 0;
  }

  async function search(event) {
    event?.preventDefault();
    setError("");
    setPicked(null);
    setRooms(null);
    setChosen(null);
    setHeld(null);
    const km = chosenDistance();
    if (mode === "nearby" && (km < 1 || km > 50)) {
      setError("Enter a distance from 1 to 50 km.");
      setStep("details");
      return;
    }
    setBusy(true);
    setNote(mode === "nearby" ? `Checking stays within ${km} km…` : "Checking live stays…");
    try {
      const place = mode === "nearby" ? (here || await beginLocationRequest()) : null;
      if (place) setHere(place);
      const found = await searchLiveHotels({
        city: mode === "nearby" ? "" : (where || city),
        latitude: place?.latitude,
        longitude: place?.longitude,
        distanceKm: mode === "nearby" ? km : undefined,
        country,
        checkin,
        checkout,
        adults,
        currency: profile?.currency || "INR",
      });
      setHotels(found.hotels || []);
      setNote("");
      setStep("list");
    } catch (err) {
      setNote("");
      const denied = err?.code === 1 || /denied|permission|not allowed/i.test(String(err?.message || ""));
      const empty = /no availability/i.test(String(err?.message || ""));
      if (empty) {
        setHotels([]);
        setError("");
        setStep("list");
      } else {
        setHotels(null);
        setError(denied ? locationError(err) : (err.message || "Live stays did not load."));
        if (!denied) setStep("details");
      }
    } finally {
      setBusy(false);
    }
  }

  async function openHotel(row) {
    const token = openToken.current + 1;
    openToken.current = token;
    setPicked(row);
    setRooms(null);
    setDetail(null);
    setChosen(null);
    setHeld(null);
    setSheet("detail");
    setError("");
    setBusy(true);
    const [found, info] = await Promise.all([
      hotelRooms({
        hotelId: row.hotelId,
        country,
        checkin,
        checkout,
        adults,
        currency: profile?.currency || "INR",
      }).catch((err) => {
        setError(err.message || "Rooms did not load.");
        return { rooms: [] };
      }),
      hotelProfile(row.hotelId).catch(() => null),
    ]);
    if (token !== openToken.current) return;
    pricedFor.current = adults;
    setRooms(found.rooms || []);
    setDetail(info);
    setBusy(false);
  }

  function submitPay() {
    const control = payRef.current?.querySelector("button, input[type='submit']");
    if (control) {
      control.click();
      return;
    }
    setError("The payment form is still opening. Nothing was charged.");
  }

  async function hold(event) {
    event?.preventDefault();
    const row = chosen;
    if (!row) return;
    if (!guest.firstName.trim() || !guest.lastName.trim() || !guest.email.includes("@")) {
      setError("Enter a first name, last name, and email before payment.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await prebookLiveHotel(row.offerId);
      setHeld({
        ...next,
        room: row.room,
        total: row.total ?? next.total,
        currency: row.currency || next.currency,
        checkin,
        checkout,
        guest: { ...guest },
        hotelName: picked?.name || "",
        hotelCity: picked?.city || where,
      });
      setSheet("pay");
    } catch (err) {
      setError(err.message || "This room could not be held.");
    } finally {
      setBusy(false);
    }
  }

  if (status && !status.enabled) {
    return <p className="web-note">Live hotel booking is not connected on this server.</p>;
  }

  const nightCount = nightsBetween(checkin, checkout);
  const cap = Number(budget);
  const km = chosenDistance();
  const shown = (hotels || []).filter((hotel) => {
    if (mode === "nearby" && hotel.distanceKm != null && km && hotel.distanceKm > km) return false;
    if (!cap) return true;
    const total = Number(hotel.total);
    if (hotel.catalog && !Number.isFinite(total)) return true;
    return Number.isFinite(total) && total / nightCount <= cap;
  });
  const emptyCopy = hotels?.length && cap
    ? "Nothing in that list is within the budget."
    : mode === "nearby"
      ? `No stays came back within ${km || "that"} km.`
      : "No stays came back for that city and those dates.";

  const priced = shown.filter((hotel) => Number.isFinite(Number(hotel.total)));
  const topRated = shown.reduce((best, hotel) => (Number(hotel.rating) > Number(best?.rating || 0) ? hotel : best), null);
  const lowest = priced.reduce((best, hotel) => (best == null || Number(hotel.total) < Number(best.total) ? hotel : best), null);
  const groups = groupRooms(rooms);
  const due = chosen ? money(held?.total ?? chosen.total, held?.currency || chosen.currency) : "";
  const dueNight = chosen ? nightPrice({ total: held?.total ?? chosen.total, currency: held?.currency || chosen.currency }, nightCount) : "";
  const guestName = [guest.firstName, guest.lastName].filter(Boolean).join(" ");
  const savedName = String(profile?.name || "").trim();
  const fromSaved = !otherGuest && Boolean(guestName) && guestName === savedName && guest.email === (account?.email || "");
  const steps = [["detail", "Room & rate"], ["guests", "Guests"], ["review", "Review"], ["pay", "Confirm & pay"]];
  const stepIndex = steps.findIndex(([id]) => id === sheet);

  function badgeFor(hotel) {
    if (topRated?.hotelId && hotel.hotelId === topRated.hotelId && Number(hotel.rating) > 0) return "Top rated";
    if (lowest?.hotelId && hotel.hotelId === lowest.hotelId && hotel.hotelId !== topRated?.hotelId) return "Lowest price";
    return "";
  }

  function moveRail(dir) {
    const rail = railRef.current;
    const card = rail?.querySelector(".stay-card");
    if (!rail || !card) return;
    const width = card.getBoundingClientRect().width + 12;
    rail.scrollBy({ left: dir * width, behavior: "smooth" });
  }

  function closeSheet() {
    setSheet("");
    setPicked(null);
    setDetail(null);
    setViewer(null);
    setChosen(null);
    setHeld(null);
    setError("");
  }

  function toggleSave(row) {
    const nights = nightCount;
    onSave?.({
      hotelId: row.hotelId,
      name: row.name,
      city: row.city || where || city,
      photo: row.photo || "",
      rating: row.rating || "",
      reviews: row.reviews || "",
      stars: row.stars || "",
      total: row.total,
      currency: row.currency || "",
      catalog: Boolean(row.catalog),
      checkin,
      checkout,
      nights,
      nightly: nightPrice(row, nights),
      when: [staySpan(checkin, checkout), nights ? `${nights} night${nights === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · "),
    });
  }

  return (
    <div className="stay-panel">
      <div className="stay-head">
        <div>
          <p className="stay-kicker">Stay options</p>
          <p className="stay-when">{[staySpan(checkin, checkout), nightCount ? `${nightCount} night${nightCount === 1 ? "" : "s"}` : "", mode === "nearby" ? `within ${km || distance} km` : placeLabel(where || city), Number(budget) > 0 ? `up to ${money(Number(budget), profile?.currency || "INR")} / night` : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" className="stay-change" onClick={() => setDatesOpen((open) => !open)}>Change dates</button>
      </div>
      {datesOpen ? (
        <form className="stay-dates" onSubmit={(event) => { event.preventDefault(); if (mode !== "nearby") setWhere(cityDraft.trim()); setDatesOpen(false); }}>
          {mode !== "nearby" ? <label>City<input value={cityDraft} onChange={(event) => setCityDraft(event.target.value)} /></label> : null}
          <label>Check-in<input type="date" value={checkin} min={localToday()} onChange={(event) => setCheckin(event.target.value)} /></label>
          <label>Check-out<input type="date" value={checkout} min={checkin || localToday(1)} onChange={(event) => setCheckout(event.target.value)} /></label>
          <label>People<input type="number" min="1" max="6" value={adults} onChange={(event) => setAdults(Number(event.target.value) || 1)} /></label>
          <label>Budget per night<input type="number" min="0" inputMode="numeric" placeholder="Any" value={budget} onChange={(event) => setBudget(event.target.value)} /></label>
          {mode === "nearby" ? <label>Km<input type="number" min="1" max="50" value={distance} onChange={(event) => setDistance(event.target.value)} /></label> : null}
          <button type="submit" className="stay-book">Update</button>
        </form>
      ) : null}
      {step === "location" ? (
        <div className="stay-empty">
          <p>Allow location to see stays near you.</p>
          {error ? <p className="web-error">{error}</p> : null}
          <button type="button" className="stay-book" onClick={allowLocation} disabled={busy}>{busy ? "Waiting for location…" : "Allow location"}</button>
          <button type="button" className="stay-change" onClick={() => chooseMode("city")}>Search by city instead</button>
        </div>
      ) : null}
      {busy && !shown.length ? <p className="stay-when">Checking live stays…</p> : null}
      {error && step !== "location" ? <p className="web-error">{error}</p> : null}
      {shown.length ? (
        <>
          <div className="stay-rail" ref={railRef} onScroll={(event) => {
            const rail = event.currentTarget;
            const card = rail.querySelector(".stay-card");
            const width = card ? card.getBoundingClientRect().width + 12 : 1;
            setSlide(Math.round(rail.scrollLeft / width));
          }}>
            {shown.map((hotel) => (
              <StayCard
                key={hotel.hotelId}
                row={hotel}
                nights={nightCount}
                badge={badgeFor(hotel)}
                saved={saved.some((item) => item.hotelId === hotel.hotelId)}
                onOpen={openHotel}
                onSave={toggleSave}
                onAsk={onAsk ? () => onAsk(`Tell me about ${hotel.name}${hotel.city ? ` in ${hotel.city}` : ""}`) : null}
              />
            ))}
          </div>
          <div className="stay-pager">
            <button type="button" aria-label="Previous stays" onClick={() => moveRail(-1)}>‹</button>
            <span>{Math.min(shown.length, slide + 1)} of {shown.length}</span>
            <button type="button" aria-label="Next stays" onClick={() => moveRail(1)}>›</button>
          </div>
          {shown.some((hotel) => hotel.catalog) ? <p className="stay-when">The booking partner has these hotels, and no room price for these dates.</p> : null}
          {status?.sandbox ? <p className="stay-when">Sandbox. A payment here uses a test card and does not book a real room.</p> : null}
        </>
      ) : null}
      {step === "list" && hotels && !shown.length ? (
        <div className="stay-empty">
          <p>{emptyCopy}</p>
          <button type="button" className="stay-change" onClick={() => setDatesOpen(true)}>Change dates</button>
        </div>
      ) : null}
      {picked && sheet === "detail" ? (
        <div className="stay-modal" role="dialog" aria-modal="true" aria-label={picked.name}>
          <div className="stay-dialog is-detail">
            <StayGallery photos={galleryOf(detail, picked)} onClose={closeSheet} onOpen={(index) => setViewer({ photos: galleryOf(detail, picked), start: index })} />
            <div className="stay-detail">
              <div className="stay-facts">
                <div>
                  <h2>{detail?.name || picked.name}</h2>
                  <p className="stay-when">
                    {[
                      scoreText(detail?.rating || picked.rating) ? `${scoreText(detail?.rating || picked.rating)} / 10` : "",
                      (detail?.reviewCount || picked.reviews) ? `${detail?.reviewCount || picked.reviews} reviews` : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                  <p className="stay-when">{[picked.stars ? `${picked.stars}-star` : "", detail?.city || picked.city || "", picked.distanceKm != null ? `${picked.distanceKm} km away` : ""].filter(Boolean).join(" · ")}</p>
                </div>
                <div>
                  {Number.isFinite(Number(picked.total)) ? <strong className="stay-summary-total">{money(picked.total, picked.currency)}</strong> : <strong>No live price</strong>}
                  <p className="stay-when">{[nightPrice(picked, nightCount) ? `${nightPrice(picked, nightCount)} a night` : "", nightCount ? `${nightCount} night${nightCount === 1 ? "" : "s"}` : "", staySpan(checkin, checkout), `${adults} adult${adults === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
                  {picked.refundable == null ? null : <p className="stay-when">{picked.refundable ? "Refundable" : "Non-refundable"}</p>}
                </div>
              </div>
              {detail?.description ? <p className="stay-copy">{detail.description}</p> : null}
              <section>
                <h3>Choose your room</h3>
                {rooms == null ? <p className="stay-when">Loading rooms…</p> : null}
                {groups.map((group) => {
                  const info = matchRoom(detail?.rooms, group.name);
                  return (
                    <article key={group.name} className="stay-room is-detail">
                      <RoomShots photos={info?.photos} onOpen={(photos, index) => setViewer({ photos, start: index })} />
                      <div>
                        <h3>{info?.name || group.name}</h3>
                        <p className="stay-when">{[info?.sleeps ? `Sleeps ${info.sleeps}` : "", info?.beds || "", info?.size || ""].filter(Boolean).join(" · ")}</p>
                        {info?.description ? <RoomCopy text={info.description} /> : null}
                        {info?.amenities?.length ? <p className="stay-when">{info.amenities.join(" · ")}</p> : null}
                        {group.rates.map((rate) => (
                          <button key={rate.offerId} type="button" className={chosen?.offerId === rate.offerId ? "stay-rate is-on" : "stay-rate"} onClick={() => { setChosen(rate); setHeld(null); }}>
                            <span>
                              <strong>{rate.board || "Room rate"}</strong>
                              <small>{refundText(rate)}</small>
                            </span>
                            <em>{nightPrice(rate, nightCount) ? `${nightPrice(rate, nightCount)} / night` : money(rate.total, rate.currency)}</em>
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
                {(detail?.rooms || []).filter((room) => !groups.some((group) => matchRoom([room], group.name))).map((room) => (
                  <article key={room.id || room.name} className="stay-room is-detail">
                    <RoomShots photos={room.photos} onOpen={(photos, index) => setViewer({ photos, start: index })} />
                    <div>
                      <h3>{room.name}</h3>
                      <p className="stay-when">{[room.sleeps ? `Sleeps ${room.sleeps}` : "", room.beds, room.size].filter(Boolean).join(" · ")}</p>
                      {room.description ? <RoomCopy text={room.description} /> : null}
                      {room.amenities?.length ? <p className="stay-when">{room.amenities.join(" · ")}</p> : null}
                      <p className="stay-when">No live price for these dates.</p>
                    </div>
                  </article>
                ))}
                {rooms && !rooms.length && !(detail?.rooms || []).length ? <p className="stay-when">No rooms came back for these dates.</p> : null}
              </section>
              {detail?.categories?.length || detail?.pros?.length || detail?.cons?.length || detail?.reviews?.length ? (
                <div className="stay-reviews">
                  {detail?.categories?.length ? (
                    <details className="stay-fold">
                      <summary><em>Guest reviews</em><span>{detail.categories.length}</span></summary>
                      <div className="stay-score-list">
                        {detail.categories.map((item) => (
                          <div key={item.name}>
                            <div className="stay-score">
                              <span>{item.name}</span>
                              <i><b style={{ width: `${Math.max(0, Math.min(100, (Number(item.rating) / 10) * 100))}%` }} /></i>
                              <strong>{scoreText(item.rating)}</strong>
                            </div>
                            {item.description ? <p className="stay-when">{item.description}</p> : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                  {detail?.pros?.length || detail?.cons?.length ? (
                    <details className="stay-fold">
                      <summary><em>What guests mention</em><span>{(detail.pros?.length || 0) + (detail.cons?.length || 0)}</span></summary>
                      <div className="stay-amenities">
                        {detail.pros?.map((item) => <span key={item}>{item}</span>)}
                        {detail.cons?.map((item) => <span key={`con-${item}`} className="is-quiet">{item}</span>)}
                      </div>
                    </details>
                  ) : null}
                  {detail?.reviews?.length ? (
                    <details className="stay-fold">
                      <summary><em>Reviews</em><span>{detail.reviews.length}</span></summary>
                      {detail.reviews.map((review) => (
                        <article key={`${review.date}-${review.headline}-${review.name}`} className="stay-review-card">
                          <p><strong>{review.headline || review.name}</strong>{scoreText(review.score) ? ` · ${scoreText(review.score)}` : ""}</p>
                          <p className="stay-when">{[review.name, reviewDate(review.date), review.country ? review.country.toUpperCase() : ""].filter(Boolean).join(" · ")}</p>
                          {review.pros ? <p>{review.pros}</p> : null}
                          {review.cons ? <p>{review.cons}</p> : null}
                        </article>
                      ))}
                    </details>
                  ) : null}
                </div>
              ) : null}
              {mapEmbed(detail?.latitude, detail?.longitude) ? (
                <section>
                  <h3>Around the hotel</h3>
                  {detail.address ? <p>{[detail.address, detail.city].filter(Boolean).join(", ")}</p> : null}
                  <button
                    type="button"
                    className="stay-map-hit"
                    onClick={() => onShowMap?.({
                      name: detail.name || picked.name,
                      address: [detail.address, detail.city].filter(Boolean).join(", "),
                      latitude: detail.latitude,
                      longitude: detail.longitude,
                    })}
                  >
                    <iframe className="stay-map" title={`Map of ${detail.name || picked.name}`} src={mapEmbed(detail.latitude, detail.longitude)} loading="lazy" />
                  </button>
                </section>
              ) : null}
              {detail?.facilities?.length ? (
                <section>
                  <h3>Amenities</h3>
                  <div className="stay-amenities">
                    {detail.facilities.map((name) => <span key={name}>{name}</span>)}
                  </div>
                </section>
              ) : null}
              {detail?.checkin || detail?.checkout || detail?.childrenAllowed != null || detail?.petsAllowed != null || detail?.parking ? (
                <section>
                  <h3>Good to know</h3>
                  <dl className="stay-know">
                    {detail.checkin ? <div><dt>Check-in</dt><dd>{detail.checkin}</dd></div> : null}
                    {detail.checkout ? <div><dt>Check-out</dt><dd>{detail.checkout}</dd></div> : null}
                    {detail.childrenAllowed == null ? null : <div><dt>Children</dt><dd>{detail.childrenAllowed ? "Allowed" : "Not allowed"}</dd></div>}
                    {detail.petsAllowed == null ? null : <div><dt>Pets</dt><dd>{detail.petsAllowed ? "Allowed" : "Not allowed"}</dd></div>}
                    {detail.parking ? <div><dt>Parking</dt><dd>{detail.parking}</dd></div> : null}
                  </dl>
                </section>
              ) : null}
              {detail?.important ? (
                <section>
                  <h3>Before you book</h3>
                  <p className="stay-copy">{detail.important}</p>
                </section>
              ) : null}
              {viewer?.photos?.length ? <PhotoViewer photos={viewer.photos} start={viewer.start || 0} onClose={() => setViewer(null)} /> : null}
              {busy && !detail ? <p className="stay-when">Loading hotel photos…</p> : null}
              {error ? <p className="web-error">{error}</p> : null}
              <div className="stay-detail-actions">
                <div className="stay-action-links">
                  <button type="button" className={saved.some((item) => item.hotelId === picked.hotelId) ? "is-on" : ""} onClick={() => toggleSave(picked)}>{saved.some((item) => item.hotelId === picked.hotelId) ? "Shortlisted" : "Shortlist"}</button>
                  {onAsk ? <button type="button" onClick={() => onAsk(`Tell me about ${picked.name}${picked.city ? ` in ${picked.city}` : ""}`)}>Ask Safar</button> : null}
                </div>
                <button type="button" className="stay-book" disabled={!chosen} onClick={() => setSheet("guests")}>Continue with this room</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {picked && sheet && sheet !== "detail" ? (
        <div className="stay-modal" role="dialog" aria-modal="true" aria-label={picked.name}>
          <div className="stay-dialog is-flow">
            <header className="stay-dialog-head">
              {picked.photo ? <img src={picked.photo} alt="" /> : <span className="stay-photo-empty" />}
              <div>
                <strong>{picked.name}</strong>
                <p>{[staySpan(checkin, checkout), nightCount ? `${nightCount} night${nightCount === 1 ? "" : "s"}` : "", `${adults} adult${adults === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}</p>
                <p>{chosen?.room || "Room not chosen yet"}</p>
              </div>
              <button type="button" className="stay-x" onClick={closeSheet} aria-label="Close">×</button>
            </header>
            <ol className="stay-steps">
              {steps.map(([id, label], index) => {
                const done = index < stepIndex;
                const on = index === stepIndex;
                return (
                  <li key={id} className={done ? "is-done" : on ? "is-on" : ""}>
                    <span>{done ? <StepCheck /> : on && id === "guests" ? <StepPerson /> : null}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
            <div className="stay-dialog-grid">
              <div className="stay-main">
                {sheet === "room" ? (
                  <>
                    <h2>Choose your room</h2>
                    <p className="stay-when">These are the hotel’s rooms for your dates, priced live. Pick the one to book.</p>
                    {rooms == null ? <p className="stay-when">Loading rooms…</p> : null}
                    {groups.map((group) => (
                      <article key={group.name} className="stay-room">
                        {group.photos?.[0] ? <img src={group.photos[0]} alt="" /> : null}
                        <div>
                          <h3>{group.name}</h3>
                          {group.rates.map((rate) => (
                            <button key={rate.offerId} type="button" className={chosen?.offerId === rate.offerId ? "stay-rate is-on" : "stay-rate"} onClick={() => { setChosen(rate); setHeld(null); }}>
                              <span>
                                <strong>{rate.board || "Room rate"}</strong>
                                <small>{refundText(rate)}</small>
                              </span>
                              <em>{nightPrice(rate, nightCount) ? `${nightPrice(rate, nightCount)} / night` : money(rate.total, rate.currency)}</em>
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                    {rooms && !rooms.length ? <p className="stay-when">No rooms came back for these dates.</p> : null}
                  </>
                ) : null}
                {sheet === "guests" ? (
                  <>
                    <div className="stay-guest-bar">
                      <span><StepPerson /> {adults} adult{adults === 1 ? "" : "s"} · 1 room</span>
                      <button type="button" className="stay-link" onClick={() => setGuestsOpen((open) => !open)}>Change guests</button>
                    </div>
                    {guestsOpen ? (
                      <div className="stay-guest-count">
                        <button type="button" onClick={() => setAdults((count) => Math.max(1, count - 1))} aria-label="Fewer adults">−</button>
                        <span>{adults} adult{adults === 1 ? "" : "s"}</span>
                        <button type="button" onClick={() => setAdults((count) => Math.min(8, count + 1))} aria-label="More adults">+</button>
                      </div>
                    ) : null}
                    {adults !== pricedFor.current ? <p className="stay-when">This room was priced for {pricedFor.current} adult{pricedFor.current === 1 ? "" : "s"}. Go back and choose the room again for the new count.</p> : null}
                    <h2>Confirm {guest.firstName || "the guest"}’s details.</h2>
                    <article className="stay-traveler">
                      <div className="stay-traveler-top">
                        <span className="stay-avatar" aria-hidden="true"><StepPerson /></span>
                        <div>
                          <strong>{guestName || "Guest"}</strong>
                          {fromSaved ? <small className="stay-saved"><StepCheck /> From your saved travelers</small> : null}
                        </div>
                      </div>
                      {editingGuest ? (
                        <div className="web-stay-guest">
                          <label>First name<input value={guest.firstName} onChange={(event) => setGuest({ ...guest, firstName: event.target.value })} /></label>
                          <label>Last name<input value={guest.lastName} onChange={(event) => setGuest({ ...guest, lastName: event.target.value })} /></label>
                          <label>Email<input type="email" value={guest.email} onChange={(event) => setGuest({ ...guest, email: event.target.value })} /></label>
                          {!otherGuest && profile?.phone ? <label>Phone<input value={profile.phone} readOnly /></label> : null}
                        </div>
                      ) : (
                        <dl className="stay-traveler-facts">
                          {guest.email ? <div><dt>Email</dt><dd>{guest.email}</dd></div> : null}
                          {!otherGuest && profile?.phone ? <div><dt>Phone</dt><dd>{profile.phone}</dd></div> : null}
                        </dl>
                      )}
                      <div className="stay-traveler-actions">
                        <label>
                          <input type="checkbox" checked={editingGuest} onChange={(event) => setEditingGuest(event.target.checked)} />
                          Edit these details
                        </label>
                        <button type="button" className="stay-link" onClick={() => { setOtherGuest(true); setEditingGuest(true); setGuest({ firstName: "", lastName: "", email: "" }); }}>Choose someone else</button>
                      </div>
                    </article>
                    {error ? <p className="web-error">{error}</p> : null}
                  </>
                ) : null}
                {sheet === "review" ? (
                  <>
                    <h2>Review your stay</h2>
                    <p className="stay-when">The hotel holds the reservation exactly as shown here.</p>
                    <dl className="stay-review">
                      <div><dt>Your stay</dt><dd>{chosen?.room || picked.name}</dd></div>
                      <div><dt>Rate</dt><dd>{[chosen?.board, refundText(chosen || {})].filter(Boolean).join(" · ")}</dd></div>
                      <div><dt>Dates</dt><dd>{staySpan(checkin, checkout)} · {nightCount} night{nightCount === 1 ? "" : "s"}</dd></div>
                      <div><dt>Guests</dt><dd>{adults} adult{adults === 1 ? "" : "s"} · 1 room</dd></div>
                      <div><dt>Lead guest</dt><dd>{guestName}</dd></div>
                      <div><dt>Email</dt><dd>{guest.email}</dd></div>
                    </dl>
                    {error ? <p className="web-error">{error}</p> : null}
                  </>
                ) : null}
                {sheet === "pay" ? (
                  <>
                    <h2>The hotel re-checked this rate before payment</h2>
                    <p className="stay-when">Nothing has been charged yet. The card is charged by the booking partner. Safar never sees or stores it.</p>
                    <dl className="stay-review">
                      <div><dt>Room</dt><dd>{chosen?.room || ""}</dd></div>
                      <div><dt>Rate</dt><dd>{[chosen?.board, refundText(chosen || {})].filter(Boolean).join(" · ")}</dd></div>
                      <div><dt>Total</dt><dd>{due}</dd></div>
                    </dl>
                    {busy ? <p className="stay-when">Holding the room…</p> : null}
                    {held ? <div id="safar-hotel-pay" ref={payRef} className="web-hotel-pay" /> : null}
                    {error ? <p className="web-error">{error}</p> : null}
                  </>
                ) : null}
                {sheet !== "detail" && sheet !== "room" && sheet !== "guests" ? (
                  <div className="stay-nav">
                    <button type="button" className="stay-change" onClick={() => setSheet(sheet === "review" ? "guests" : "review")}>Back</button>
                  </div>
                ) : null}
                {sheet === "guests" ? (
                  <div className="stay-nav">
                    <button type="button" className="stay-change" onClick={() => setSheet("detail")}>Back</button>
                  </div>
                ) : null}
                {sheet === "room" ? (
                  <div className="stay-nav">
                    <span />
                    <button type="button" className="stay-book" disabled={!chosen} onClick={() => setSheet("guests")}>Continue with this room</button>
                  </div>
                ) : null}
              </div>
              <aside className="stay-summary">
                {picked.photo ? <img src={picked.photo} alt="" /> : null}
                <strong>{picked.name}</strong>
                {picked.address || picked.city ? <p className="stay-summary-address"><StayPin /> {[picked.address, picked.city].filter(Boolean).join(", ")}</p> : null}
                <p className="stay-total-kicker">Stay total</p>
                <p className="stay-summary-total">{due || nightPrice(picked, nightCount) || "Room not chosen yet"}</p>
                <p className="stay-summary-note">Safar re-checks this with the hotel before payment opens.</p>
                <p className="stay-total-kicker">Stay</p>
                <ul className="stay-summary-facts">
                  <li><StayBed /> {nightCount} night{nightCount === 1 ? "" : "s"} · {staySpan(checkin, checkout)}</li>
                  <li><StepPerson /> {adults} adult{adults === 1 ? "" : "s"} · 1 room</li>
                  <li><StayBed /> {chosen ? [chosen.room, chosen.board].filter(Boolean).join(" · ") : "Room not chosen yet"}</li>
                </ul>
                {chosen && refundText(chosen) ? (
                  <>
                    <p className="stay-total-kicker">If plans change</p>
                    <ul className="stay-summary-facts">
                      <li><StayChange /> {refundText(chosen)}</li>
                    </ul>
                  </>
                ) : null}
                {dueNight && due ? <p className="stay-when">{dueNight} / night</p> : null}
              </aside>
            </div>
            {sheet === "guests" || sheet === "review" || sheet === "pay" ? (
              <footer className="stay-dialog-foot">
                {sheet === "guests" ? <button type="button" className="stay-book" onClick={() => { if (!guest.firstName.trim() || !guest.lastName.trim() || !guest.email.includes("@")) { setError("Enter a first name, last name, and email."); return; } setError(""); setSheet("review"); }}>Continue to review</button> : null}
                {sheet === "review" ? <button type="button" className="stay-book" disabled={busy} onClick={hold}>{busy ? "Checking the rate…" : "Continue to payment"}</button> : null}
                {sheet === "pay" ? <button type="button" className="stay-book" onClick={submitPay} disabled={!held}>{due ? `Pay ${due}` : "Pay"}</button> : null}
              </footer>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
