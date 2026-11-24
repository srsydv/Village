import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  attachLiveSeat,
  bookLiveFlight,
  flightStatus,
  listTickets,
  prebookLiveFlight,
  searchLiveFlights,
  verifyLiveFlight,
} from "../lib/api.js";
import { formatDay } from "../lib/dates.js";
import { useTravel } from "../lib/TravelContext.jsx";
import "./site/try.css";

const STEPS = [
  ["fare", "Flight & fare"],
  ["traveler", "Travelers"],
  ["bags", "Seats & bags"],
  ["review", "Review & pay"],
];

function stepIndex(step) {
  const id = step === "pay" ? "review" : step;
  return STEPS.findIndex(([stepId]) => stepId === id);
}

function duration(minutes) {
  const total = Number(minutes) || 0;
  if (!total) return "";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function when(iso) {
  if (!iso) return "";
  const day = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(day.getTime())) return iso;
  return day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function bornLine(person) {
  const day = person?.birthday ? new Date(`${person.birthday}T12:00:00`) : null;
  const date = day && !Number.isNaN(day.getTime())
    ? day.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";
  const gender = person?.gender === "F" ? "Female" : person?.gender === "M" ? "Male" : "";
  return [date ? `Born ${date}` : "", gender].filter(Boolean).join(" · ");
}

function holdLeft(iso) {
  if (!iso) return "";
  const raw = String(iso);
  const end = /^\d+$/.test(raw) ? Number(raw) * (raw.length <= 10 ? 1000 : 1) : Date.parse(raw);
  if (!Number.isFinite(end)) return "";
  const left = end - Date.now();
  if (left <= 0) return "";
  const total = Math.floor(left / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function money(amount, currency = "INR") {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function cabinPlan(seats) {
  const columns = [...new Set(seats.map((item) => item.column))].filter(Boolean).sort();
  const position = {};
  for (const seat of seats) {
    if (seat.column && seat.position) position[seat.column] = seat.position;
  }
  const aisleBefore = new Set();
  for (let index = 1; index < columns.length; index += 1) {
    if (position[columns[index - 1]] === "aisle" && position[columns[index]] === "aisle") {
      aisleBefore.add(columns[index]);
    }
  }
  const parts = ["1.6rem"];
  for (const column of columns) {
    if (aisleBefore.has(column)) parts.push("0.9rem");
    parts.push("1.75rem");
  }
  return { columns, aisleBefore, template: parts.join(" ") };
}

function localToday() {
  const day = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

function countryCode(nationality) {
  const text = String(nationality || "India").toLowerCase();
  if (text === "india" || text.startsWith("in")) return "IN";
  if (text.length === 2) return text.toUpperCase();
  return "IN";
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
    script.onerror = () => reject(new Error("The payment form could not be loaded."));
    document.head.appendChild(script);
  });
}

let issueTask = null;

function startIssue() {
  if (issueTask) return issueTask;
  const url = new URL(window.location.href);
  if (url.searchParams.get("flightPaid") !== "1") return null;
  const raw = sessionStorage.getItem("safar.pendingTicket");
  if (!raw) return null;
  let pending;
  try {
    pending = JSON.parse(raw);
  } catch {
    return null;
  }
  issueTask = bookLiveFlight(pending)
    .then((issued) => {
      sessionStorage.removeItem("safar.pendingTicket");
      url.searchParams.delete("flightPaid");
      const next = `${url.pathname}${url.search}`;
      window.history.replaceState({}, "", next);
      return issued;
    })
    .catch((err) => {
      issueTask = null;
      throw err;
    });
  return issueTask;
}

export function FlightIssue({ variant = "app", onTicket }) {
  const [phase, setPhase] = useState("idle");
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState("");
  const web = variant === "web";

  useEffect(() => {
    const task = startIssue();
    if (!task) return undefined;
    setPhase("issuing");
    let cancel = false;
    task
      .then((issued) => {
        if (cancel) return;
        setTicket(issued);
        setPhase("done");
        onTicket?.(issued);
      })
      .catch((err) => {
        if (cancel) return;
        setError(err.message || "The airline is still issuing the ticket. Check Tickets in a few minutes before paying again.");
        setPhase("error");
      });
    return () => {
      cancel = true;
    };
  }, [onTicket]);

  if (phase === "idle") return null;
  return (
    <section className={web ? "web-issue" : "mx-4 mt-4 rounded-2xl border border-[var(--line)] px-4 py-4"}>
      {phase === "issuing" ? (
        <>
          <p className={web ? "" : "text-sm font-medium"}>Payment received. Issuing your ticket.</p>
          <p className={web ? "web-note" : "mt-1 text-xs text-[var(--muted)]"}>
            The airline can take a few minutes. Stay on this page. The ticket will show here and in Tickets. You don’t need to pay again.
          </p>
        </>
      ) : null}
      {phase === "done" && ticket ? (
        <>
          <p className={web ? "" : "text-sm font-medium"}>Ticket issued · {ticket.bookingRef || ticket.bookingId}</p>
          <p className={web ? "web-note" : "mt-1 text-xs text-[var(--muted)]"}>
            {ticket.airlinePnr ? `Airline code ${ticket.airlinePnr}. ` : "The airline code appears when the airline assigns it. "}
            It’s saved in Tickets.
            {ticket.sandbox ? " This is a test booking, not a real airline ticket." : ""}
          </p>
        </>
      ) : null}
      {phase === "error" ? <p className={web ? "web-error" : "text-sm text-[var(--rose)]"}>{error}</p> : null}
    </section>
  );
}

function pendingPayload(held, fare, traveler, date) {
  return {
    prebookId: held.prebookId,
    transactionId: held.transactionId,
    email: traveler.email,
    name: traveler.name,
    from: fare.from,
    to: fare.to,
    date,
    airline: fare.airline,
    flight: fare.flight,
    depart: fare.depart,
    arrive: fare.arrive,
    total: held.total || fare.price?.total,
    currency: held.currency || fare.price?.currency,
  };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WHEEL = 36;

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function readBirthday(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return { year: 2000, month: 5, day: 18 };
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function WheelColumn({ label, items, selected, onSelect, light }) {
  const ref = useRef(null);
  const moving = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || moving.current) return;
    const index = Math.max(0, items.findIndex((item) => item.value === selected));
    moving.current = true;
    node.scrollTop = index * WHEEL;
    window.setTimeout(() => {
      moving.current = false;
    }, 80);
  }, [items, selected]);

  return (
    <div className={light ? "web-wheel" : "relative h-[148px] overflow-hidden"}>
      <div
        ref={ref}
        className={light ? "web-wheel-view" : "h-[148px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] snap-y snap-mandatory [&::-webkit-scrollbar]:hidden"}
        onScroll={(event) => {
          if (moving.current) return;
          moving.current = true;
          const index = Math.round(event.currentTarget.scrollTop / WHEEL);
          const item = items[Math.max(0, Math.min(items.length - 1, index))];
          if (item && item.value !== selected) onSelect(item.value);
          window.clearTimeout(event.currentTarget._safarWheel);
          event.currentTarget._safarWheel = window.setTimeout(() => {
            moving.current = false;
          }, 140);
        }}
      >
        <div className={light ? "web-wheel-pad" : "h-14"} />
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            className={item.value === selected ? (light ? "is-on" : "block h-9 w-full snap-center text-base font-semibold text-[var(--cream)]") : (light ? "" : "block h-9 w-full snap-center text-sm text-[var(--muted)]")}
            onClick={() => onSelect(item.value)}
          >
            {item.label}
          </button>
        ))}
        <div className={light ? "web-wheel-pad" : "h-14"} />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function HoldClock({ iso, web }) {
  const [label, setLabel] = useState(() => holdLeft(iso));
  useEffect(() => {
    const tick = () => setLabel(holdLeft(iso));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  if (!label) return null;
  return (
    <p className={web ? "web-hold" : "mb-2 flex items-center justify-between text-[0.75rem] text-[var(--muted)]"}>
      <span>Checkout window remaining</span>
      <strong>{label}</strong>
    </p>
  );
}

function ReviewBody({ web, people, partyCount, traveler, fare, held, seat, extra, travelDate }) {
  const currency = held?.currency || fare?.price?.currency || "";
  const due = held?.total ?? fare?.price?.total ?? null;
  const fareTotal = fare?.price?.total ?? null;
  const added = due != null && fareTotal != null && Math.abs(due - fareTotal) > 0.009 ? due - fareTotal : null;
  const priceRows = [
    ["Base fare", fare?.price?.base],
    ["Taxes", fare?.price?.taxes],
    ["Fees", fare?.price?.fees],
    ["Seats", seat ? seat.price : null],
    [extra?.name, extra ? extra.price : null],
  ].filter(([label, amount]) => label && amount != null);
  const flightMeta = [fare?.cabin, fare?.family, fare?.seatsLeft ? `${fare.seatsLeft} left` : ""].filter(Boolean);
  const whenLine = [when(travelDate), fare?.depart].filter(Boolean).join(" · ");
  const tripLine = [duration(fare?.minutes), fare?.stopLabel].filter(Boolean).join(" · ");
  const picks = [
    seat ? [`Seat ${seat.number}`, [fare?.from && fare?.to ? `${fare.from} → ${fare.to}` : "", fare?.flight].filter(Boolean).join(" · "), seat.price] : null,
    extra ? [extra.name, "", extra.price] : null,
  ].filter(Boolean);
  const kicker = web ? "web-review-kicker" : "mt-4 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]";
  const row = web ? "web-price-row" : "mt-2 flex items-start justify-between gap-3 text-sm";

  return (
    <div className={web ? "web-review" : "grid items-start gap-4 sm:grid-cols-[1.1fr_0.9fr]"}>
      <div>
        <h3 className={web ? "web-review-title" : "text-lg font-semibold"}>Review your booking</h3>
        <p className={web ? "web-review-sub" : "mt-1 text-xs text-[var(--muted)]"}>The airline issues the ticket exactly as shown here.</p>
        <p className={kicker}>Traveler</p>
        {people.slice(0, partyCount).map((person, index) => (
          <div key={`${person.name}-${index}`} className={index ? "mt-2" : ""}>
            <p className={web ? "web-review-name" : "text-sm font-medium"}>{person.name}</p>
            {bornLine(person) ? <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>{bornLine(person)}</p> : null}
          </div>
        ))}
        {picks.length ? (
          <>
            <p className={kicker}>Seats and bags</p>
            {picks.map(([label, detail, amount]) => (
              <p key={label} className={row}>
                <span>{detail ? `${label} · ${detail}` : label}</span>
                {amount != null ? <span>{money(amount, seat?.currency || extra?.currency || currency)}</span> : null}
              </p>
            ))}
          </>
        ) : null}
        <p className={kicker}>Confirmation</p>
        <p className={web ? "" : "text-sm"}>Sent to {traveler.email}, along with any flight changes.</p>
        <p className={web ? "web-review-sub" : "mt-3 text-[0.7rem] text-[var(--muted)]"}>
          Payment and ticketing are handled by the booking partner. Safar never sees or stores the card.
          Returning from the bank does not confirm a ticket on its own.
        </p>
      </div>
      <aside className={web ? "web-review-card" : "rounded-2xl border border-[var(--line)] p-3"}>
        <HoldClock iso={fare?.expiresAt} web={web} />
        <p className={web ? "web-due" : "flex items-baseline justify-between gap-3"}>
          <span>Total due</span>
          <strong className={web ? "" : "text-2xl"}>{due == null ? "—" : money(due, currency)}</strong>
        </p>
        {added != null && added > 0 ? (
          <p className={web ? "web-price-more" : "mt-1 text-xs text-[var(--muted)]"}>
            <s>{money(fareTotal, fare?.price?.currency || currency)}</s>
            + {money(added, currency)} more
          </p>
        ) : null}
        {priceRows.map(([label, amount]) => (
          <p key={label} className={row}>
            <span>{label}</span>
            <span>{money(amount, label === extra?.name ? extra.currency || currency : label === "Seats" ? seat?.currency || currency : fare?.price?.currency || currency)}</span>
          </p>
        ))}
        <div className={web ? "web-rule" : "my-3 h-px bg-[var(--line)]"} />
        <p className={kicker}>Flight</p>
        {fare?.from && fare?.to ? <p className={web ? "web-review-name" : "text-sm font-medium"}>{fare.from} → {fare.to}</p> : null}
        {whenLine ? <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>{whenLine}</p> : null}
        {tripLine ? <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>{tripLine}</p> : null}
        {flightMeta.length ? <p className={web ? "web-note" : "mt-2 text-xs text-[var(--muted)]"}>{flightMeta.join(" · ")}</p> : null}
        <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>{partyCount} traveler{partyCount === 1 ? "" : "s"}</p>
        {fare?.baggage?.length || fare?.terms?.length ? (
          <>
            <p className={kicker}>Fare</p>
            {(fare.baggage || []).map((item) => <p key={item} className={web ? "web-fare-line" : "mt-1 text-sm"}>{item}</p>)}
            {(fare.terms || []).map((item) => <p key={item} className={web ? "web-fare-line" : "mt-1 text-sm"}>{item}</p>)}
          </>
        ) : null}
        <p className={web ? "web-review-sub" : "mt-3 text-[0.7rem] text-[var(--muted)]"}>
          Payment is handled by the booking partner. Safar never sees or stores the card.
        </p>
      </aside>
    </div>
  );
}

function DobWheel({ value, onChange, light }) {
  const currentYear = new Date().getFullYear();
  const parsed = readBirthday(value);
  const years = [];
  for (let year = currentYear; year >= currentYear - 100; year -= 1) years.push({ value: year, label: String(year) });
  const months = MONTHS.map((label, index) => ({ value: index + 1, label }));
  const dayCount = daysInMonth(parsed.year, parsed.month);
  const days = Array.from({ length: dayCount }, (_, index) => ({ value: index + 1, label: String(index + 1) }));
  const shown = new Date(value ? `${value}T12:00:00` : `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(parsed.day).padStart(2, "0")}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  function commit(next) {
    const month = String(next.month).padStart(2, "0");
    const day = String(Math.min(next.day, daysInMonth(next.year, next.month))).padStart(2, "0");
    onChange(`${next.year}-${month}-${day}`);
  }

  useEffect(() => {
    if (value) return;
    commit(parsed);
  }, [value]);

  return (
    <div className={light ? "web-dob" : "grid gap-2"}>
      <p className={light ? "web-dob-value" : "text-sm font-medium"}>{shown}</p>
      <div className={light ? "web-wheels" : "relative grid h-[148px] grid-cols-[1.4fr_0.7fr_0.9fr] gap-2"}>
        <WheelColumn light={light} label="Month" items={months} selected={parsed.month} onSelect={(month) => commit({ ...parsed, month })} />
        <WheelColumn light={light} label="Day" items={days} selected={Math.min(parsed.day, dayCount)} onSelect={(day) => commit({ ...parsed, day })} />
        <WheelColumn light={light} label="Year" items={years} selected={parsed.year} onSelect={(year) => commit({ ...parsed, year })} />
      </div>
    </div>
  );
}

export function FlightBook({ question = "", from, to, date, variant = "app", frame = "page", onLive }) {
  const { profile, account } = useTravel();
  const [status, setStatus] = useState(null);
  const [offers, setOffers] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(null);
  const [checked, setChecked] = useState(null);
  const [held, setHeld] = useState(null);
  const [seat, setSeat] = useState(null);
  const [extra, setExtra] = useState(null);
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [tripDate, setTripDate] = useState(date || localToday());
  const [adults, setAdults] = useState(1);
  const [query, setQuery] = useState(null);
  const [people, setPeople] = useState(() => [
    { name: profile?.name || account?.name || "", birthday: "", gender: "M" },
  ]);
  const [traveler, setTraveler] = useState({
    email: account?.email || "",
    phone: String(profile?.phone || "").replace(/\D/g, "").slice(-10),
    documentNumber: "",
  });
  const payRef = useRef(null);
  const listRef = useRef(null);
  const web = variant === "web";
  const fare = checked || chosen;
  const travelDate = query?.date || tripDate || date;
  const partyCount = query?.adults || adults;

  useEffect(() => {
    let cancel = false;
    flightStatus()
      .then((next) => {
        if (cancel) return;
        setStatus(next);
        onLive?.(Boolean(next.enabled));
      })
      .catch(() => {
        if (cancel) return;
        setStatus({ enabled: false, sandbox: false });
        onLive?.(false);
      });
    return () => {
      cancel = true;
    };
  }, [from, to, question]);

  useEffect(() => {
    setQuery(null);
    setOffers(null);
    setChosen(null);
    setError("");
  }, [from, to, question]);

  useEffect(() => {
    setPeople((current) => {
      if (current.length === partyCount) return current;
      const next = current.slice(0, partyCount);
      while (next.length < partyCount) next.push({ name: "", birthday: "", gender: "M" });
      return next;
    });
  }, [partyCount]);

  useEffect(() => {
    if (!query) return undefined;
    let cancel = false;
    setOffers(null);
    setError("");
    setNote("Checking live fares…");
    searchLiveFlights({
      from,
      to,
      date: query.date,
      adults: query.adults,
      currency: profile?.currency || "INR",
      home: profile?.homeCity || "",
      question,
    })
      .then(async (found) => {
        if (cancel) return;
        setOffers(found.offers || []);
        setNote("");
        const saved = await listTickets().catch(() => []);
        if (!cancel) setTickets(saved);
      })
      .catch((err) => {
        if (cancel) return;
        setOffers([]);
        setNote("");
        setError(err.message || "Live fares did not load.");
      });
    return () => {
      cancel = true;
    };
  }, [query, from, to, question, profile?.currency, profile?.homeCity]);

  useEffect(() => {
    if (step !== "pay" || !held?.secretKey) return undefined;
    let cancel = false;
    const stripeKey = String(held.publicKey || "");
    if (stripeKey.startsWith("pk_")) {
      loadScript("https://js.stripe.com/v3/")
        .then(() => {
          if (cancel || !window.Stripe) return;
          const stripe = window.Stripe(stripeKey);
          const card = stripe.elements().create("card", { hidePostalCode: true });
          card.mount("#safar-card");
          payRef.current = { stripe, card };
        })
        .catch((err) => {
          if (!cancel) setError(err.message);
        });
    } else {
      sessionStorage.setItem("safar.pendingTicket", JSON.stringify(pendingPayload(held, fare, { ...traveler, name: people[0]?.name }, travelDate)));
      loadScript("https://payment-wrapper.liteapi.travel/dist/liteAPIPayment.js?v=a1")
        .then(() => {
          if (cancel || !window.LiteAPIPayment) {
            if (!cancel) setError("The booking partner’s payment form did not open. Nothing was charged.");
            return;
          }
          const url = new URL(window.location.href);
          url.searchParams.set("flightPaid", "1");
          const lite = new window.LiteAPIPayment({
            publicKey: status?.sandbox ? "sandbox" : "live",
            appearance: { theme: "flat" },
            options: { business: { name: "Safar" } },
            targetElement: "#safar-pay",
            secretKey: held.secretKey,
            returnUrl: url.toString(),
          });
          lite.handlePayment();
          window.setTimeout(showPartnerPay, 400);
          window.setTimeout(showPartnerPay, 1200);
        })
        .catch((err) => {
          if (!cancel) setError(err.message);
        });
    }
    return () => {
      cancel = true;
      payRef.current?.card?.destroy?.();
      payRef.current = null;
    };
  }, [step, held]);

  useEffect(() => {
    if (status?.enabled) listRef.current?.scrollIntoView({ block: "nearest" });
  }, [status?.enabled, query, offers]);

  async function openOffer(offer) {
    const first = offer.fares?.[0] || offer;
    setChosen(offer);
    setChecked(null);
    setHeld(null);
    setSeat(null);
    setExtra(null);
    setTicket(null);
    setError("");
    setStep("fare");
    setBusy(true);
    try {
      const next = await verifyLiveFlight(first.offerId);
      setChecked({ ...(next.offer || first), fares: offer.fares || [first] });
    } catch (err) {
      setError(err.message || "This fare expired. Pick another.");
      setStep("");
      setChosen(null);
    } finally {
      setBusy(false);
    }
  }

  async function chooseFare(nextFare) {
    setBusy(true);
    setError("");
    try {
      const next = await verifyLiveFlight(nextFare.offerId);
      setChecked({ ...(next.offer || nextFare), fares: fare.fares });
    } catch (err) {
      setError(err.message || "That fare is gone.");
    } finally {
      setBusy(false);
    }
  }

  async function hold() {
    setBusy(true);
    setError("");
    try {
      const flying = people.slice(0, partyCount);
      if (flying.some((person) => !person.name.trim() || !person.birthday)) {
        throw new Error("Each traveler needs a name and date of birth.");
      }
      const next = await prebookLiveFlight({
        offerId: fare.offerId,
        traveler: {
          ...traveler,
          ...flying[0],
          nationality: countryCode(profile?.nationality),
          passengers: flying.map((person, index) => ({
            ...person,
            documentNumber: index === 0 ? traveler.documentNumber : "",
            nationality: countryCode(profile?.nationality),
          })),
        },
      });
      setHeld(next);
      setStep(next.seats?.length || next.extras?.length ? "bags" : "review");
    } catch (err) {
      setError(err.message || "The airline could not hold this fare.");
    } finally {
      setBusy(false);
    }
  }

  async function keepSeat() {
    if (!seat && !extra) {
      setStep("review");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await attachLiveSeat({
        prebookId: held.prebookId,
        seat: seat?.available === false ? null : seat,
        extras: extra ? [extra] : [],
      });
      setHeld({ ...held, ...next, seats: held.seats, extras: held.extras });
      setStep("review");
    } catch (err) {
      setError(err.message || "That seat could not be added.");
    } finally {
      setBusy(false);
    }
  }

  function showPartnerPay() {
    const root = document.getElementById("safar-pay");
    if (!root) return;
    root.querySelectorAll("div, form, section").forEach((node) => {
      node.style.overflow = "visible";
      node.style.maxHeight = "none";
    });
  }

  function payWithPartner() {
    const root = document.getElementById("safar-pay");
    const buttons = [...(root?.querySelectorAll("button, [role='button']") || [])];
    const button = buttons.find((item) => /pay/i.test(item.textContent || "")) || buttons.at(-1);
    if (!button) {
      setError("The card form is still opening. Tap Pay again in a moment. Nothing has been charged.");
      return;
    }
    button.click();
  }

  async function pay() {
    if (!held?.secretKey || !payRef.current?.stripe) {
      setError("The card form is not ready. Nothing was charged.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await payRef.current.stripe.confirmCardPayment(held.secretKey, {
        payment_method: {
          card: payRef.current.card,
          billing_details: { name: traveler.name, email: traveler.email },
        },
      });
      if (result.error) throw new Error(result.error.message || "The bank declined the card.");
      if (result.paymentIntent?.status !== "succeeded") {
        throw new Error("The bank has not confirmed the payment, so no ticket was issued.");
      }
      const issued = await bookLiveFlight(pendingPayload(held, fare, { ...traveler, name: people[0]?.name }, travelDate));
      setTicket(issued);
      setTickets((current) => [issued, ...current]);
      setStep("done");
    } catch (err) {
      setError(err.message || "Payment did not finish.");
    } finally {
      setBusy(false);
    }
  }

  if (status && !status.enabled && step !== "done") return null;
  if (!status && step !== "done") {
    return (
      <p data-flights="true" className={web ? "web-note" : "text-xs text-[var(--muted)]"}>
        Checking whether live booking is open…
      </p>
    );
  }

  const ask = (
    <form
      className={web ? "web-trip-ask" : "rounded-2xl border border-[var(--line)] px-3 py-3"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!tripDate) return;
        setChosen(null);
        setError("");
        setQuery({ date: tripDate, adults, at: Date.now() });
      }}
    >
      <p className={web ? "" : "text-sm"}>One way · {from} → {to}</p>
      <div className={web ? "web-trip-fields" : "mt-3 grid gap-3 sm:grid-cols-2"}>
        <label className={web ? "" : "grid gap-1 text-xs"}>
          Departure date
          <input
            required
            type="date"
            min={localToday()}
            className={web ? "" : "field"}
            value={tripDate}
            onChange={(event) => setTripDate(event.target.value)}
          />
        </label>
        <div className={web ? "" : "grid gap-1 text-xs"}>
          <span>Travelers</span>
          <div className={web ? "web-count" : "flex items-center gap-3"}>
            <button type="button" className={web ? "" : "grid h-8 w-8 place-items-center rounded-full border border-[var(--line)]"} onClick={() => setAdults((count) => Math.max(1, count - 1))} aria-label="Fewer travelers">−</button>
            <strong>{adults}</strong>
            <button type="button" className={web ? "" : "grid h-8 w-8 place-items-center rounded-full border border-[var(--line)]"} onClick={() => setAdults((count) => Math.min(6, count + 1))} aria-label="More travelers">+</button>
          </div>
        </div>
      </div>
      <button type="submit" className={web ? "web-flight-book" : "mt-3 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-medium text-black"}>
        {query ? "Update flights" : "Show flights"}
      </button>
    </form>
  );

  if (!query && step !== "done") {
    return (
      <div ref={listRef} data-flights="true" className={web ? "web-flights" : "space-y-2"}>
        {ask}
      </div>
    );
  }
  if (!offers && step !== "done") {
    return (
      <div ref={listRef} data-flights="true" className={web ? "web-flights" : "space-y-2"}>
        {ask}
        <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>{note || "Checking live fares…"}</p>
      </div>
    );
  }

  const rows = new Map();
  for (const item of held?.seats || []) {
    if (!rows.has(item.row)) rows.set(item.row, []);
    rows.get(item.row).push(item);
  }
  const cabin = cabinPlan(held?.seats || []);
  const orderedRows = [...rows.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  const openSeats = (held?.seats || []).filter((item) => item.available).length;
  const place = (node) => (
    frame === "phone" && typeof document !== "undefined"
      ? createPortal(<div className="flight-ui is-phone">{node}</div>, document.body)
      : node
  );

  return (
    <div ref={listRef} data-flights="true" className={web ? "web-flights" : "space-y-2"}>
      {ask}
      {status?.sandbox ? (
        <p className={web ? "web-note" : "text-xs text-[var(--gold-bright)]"}>
          Sandbox. A payment here uses a test card and does not issue a real airline ticket.
        </p>
      ) : null}
      {error && !chosen ? <p className={web ? "web-error" : "text-xs text-[var(--rose)]"}>{error}</p> : null}
      {tickets.filter((item) => !offers?.length || offers.some((offer) => offer.from === item.from && offer.to === item.to)).slice(0, 3).map((item) => (
        <div key={item.bookingId || item.bookedAt} className={web ? "web-ticket" : "rounded-2xl border border-[var(--line)] px-3 py-2.5"}>
          <p className={web ? "" : "text-sm"}>{item.airline} {item.from} → {item.to}</p>
          <p className={web ? "web-note" : "text-[0.7rem] text-[var(--muted)]"}>
            {item.bookingRef || item.bookingId
              ? `${item.status === "CONFIRMED" ? "Confirmed" : item.status || "Booked"} · ${item.bookingRef || item.bookingId}`
              : "Reference not back yet"}
            {item.airlinePnr ? ` · Airline code ${item.airlinePnr}` : ""}
            {item.sandbox ? " · Test booking" : ""}
            {web ? " · Saved in Tickets" : " · Saved in Trips and Profile"}
          </p>
        </div>
      ))}
      {offers?.length ? (
        <div className={web ? "web-flight-head" : "px-1"}>
          <p className={web ? "" : "text-sm font-medium"}>Flights {offers[0].from} → {offers[0].to}</p>
          <p className={web ? "web-note" : "text-[0.7rem] text-[var(--muted)]"}>One way · {when(travelDate)}{offers[0].cabin ? ` · ${offers[0].cabin}` : ""} · {partyCount} traveler{partyCount === 1 ? "" : "s"}</p>
        </div>
      ) : null}
      {(offers || []).map((offer) => (
        <div key={`${offer.departAt}-${offer.flight}-${offer.price.total}`} className={web ? "web-flight" : "rounded-2xl border border-[var(--line)] px-3 py-3"}>
          <p className={web ? "web-note" : "text-[0.7rem] text-[var(--muted)]"}>One way · {when(travelDate)}</p>
          <p className={web ? "" : "mt-1 text-sm"}>{offer.airline}{offer.flight ? ` · ${offer.flight}` : ""}</p>
          <div className={web ? "web-flight-line" : "mt-2 flex items-center gap-2 text-sm"}>
            <strong>{offer.depart || "—"}</strong>
            <span className={web ? "web-flight-rule" : "h-px flex-1 bg-[var(--line)]"} />
            <span className={web ? "web-note" : "text-[0.65rem] text-[var(--muted)]"}>{duration(offer.minutes) || offer.stopLabel}</span>
            <span className={web ? "web-flight-rule" : "h-px flex-1 bg-[var(--line)]"} />
            <strong>{offer.arrive || "—"}</strong>
          </div>
          <p className={web ? "web-note" : "mt-1 text-[0.7rem] text-[var(--muted)]"}>{offer.from} → {offer.to} · {offer.stopLabel}</p>
          <button type="button" className={web ? "web-flight-book" : "mt-3 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-medium text-black"} onClick={() => openOffer(offer)}>
            Book from {money(offer.price.total, offer.price.currency)}
          </button>
        </div>
      ))}
      {offers && !offers.length && !error ? <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>No live seats came back for {formatDay(travelDate)}.</p> : null}
      <p className={web ? "web-note" : "text-[0.65rem] text-[var(--muted)]"}>
        Payment is handled by the booking partner. Safar never sees or stores the card.
      </p>

      {chosen ? place(
        <div className={web ? "web-sheet" : "fixed inset-0 z-50 grid place-items-end bg-black/60 p-3 sm:place-items-center"} role="dialog" aria-modal="true">
          <div className={web ? "web-sheet-card" : "max-h-[92dvh] w-full max-w-3xl overflow-auto rounded-3xl bg-[var(--paper)] p-4 text-[var(--cream)]"}>
            <div className={web ? "web-sheet-head" : "mb-3 flex items-start justify-between gap-3"}>
              <div>
                <p className={web ? "" : "text-sm font-medium"}>{fare?.airline || chosen.airline}</p>
                <p className={web ? "web-note" : "text-[0.7rem] text-[var(--muted)]"}>
                  {[`${fare?.from || chosen.from} → ${fare?.to || chosen.to}`, formatDay(travelDate), fare?.family, fare?.cabin].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button type="button" className={web ? "web-text-btn" : "text-xs text-[var(--muted)]"} onClick={() => { setChosen(null); setStep(""); setError(""); }}>
                Close
              </button>
            </div>
            {step !== "done" ? (
              <ol className={web ? "web-book-steps" : "mb-4 flex items-center overflow-x-auto text-[0.65rem]"}>
                {STEPS.map(([id, label], index) => {
                  const current = stepIndex(step);
                  const state = index < current ? "is-done" : index === current ? "is-on" : "";
                  return (
                    <li key={id} className={web ? state : `flex min-w-0 flex-1 items-center gap-1.5 ${state ? "text-[var(--gold-bright)]" : "text-[var(--muted)]"}`}>
                      <span className={web ? "web-step-mark" : `grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[0.6rem] leading-none ${state ? "border-[var(--gold)] bg-[var(--gold)] text-black" : "border-[var(--line)] text-transparent"}`}>
                        {index < current ? "✓" : ""}
                      </span>
                      <span>{label}</span>
                      {!web && index < STEPS.length - 1 ? <span className="mx-1.5 h-px min-w-3 flex-1 bg-[var(--line)]" /> : null}
                    </li>
                  );
                })}
              </ol>
            ) : null}
            {error ? <p className={web ? "web-error" : "mb-3 text-xs text-[var(--rose)]"}>{error}</p> : null}

            {step === "fare" ? (
              <div>
                <p className={web ? "" : "text-sm"}>{busy ? "Checking today’s fare with the airline." : "Choose the fare to hold."}</p>
                <div className={web ? "web-fares" : "mt-3 grid gap-2"}>
                  {(fare?.fares || [fare]).filter(Boolean).map((item) => (
                    <button
                      key={item.offerId}
                      type="button"
                      className={item.offerId === fare.offerId ? (web ? "web-fare is-on" : "rounded-2xl border border-[var(--gold)] px-3 py-2 text-left") : (web ? "web-fare" : "rounded-2xl border border-[var(--line)] px-3 py-2 text-left")}
                      onClick={() => chooseFare(item)}
                    >
                      <span className={web ? "" : "flex items-center justify-between gap-3"}>
                        <strong>{item.family}</strong>
                        <span>{money(item.price.total, item.price.currency)}</span>
                      </span>
                      <span className={web ? "web-note" : "mt-1 block text-[0.7rem] text-[var(--muted)]"}>
                        {(item.baggage || []).join(" · ")}
                        {item.seatsLeft ? ` · ${item.seatsLeft} left` : ""}
                      </span>
                    </button>
                  ))}
                </div>
                <div className={web ? "web-sheet-actions" : "mt-4 flex justify-end"}>
                  <button type="button" disabled={busy || !fare?.offerId} className={web ? "web-next" : "rounded-full bg-[var(--gold)] px-4 py-2 text-sm text-black disabled:opacity-50"} onClick={() => setStep("traveler")}>
                    Continue
                  </button>
                </div>
              </div>
            ) : null}

            {step === "traveler" ? (
              <form
                className={web ? "web-traveler" : "grid gap-3"}
                onSubmit={(event) => {
                  event.preventDefault();
                  hold();
                }}
              >
                <p className={web ? "" : "text-sm"}>Who’s flying?</p>
                {people.slice(0, partyCount).map((person, index) => (
                  <fieldset key={index} className={web ? "web-person" : "grid gap-3 rounded-2xl border border-[var(--line)] p-3"}>
                    <legend className={web ? "web-note" : "px-1 text-xs text-[var(--muted)]"}>Traveler {index + 1}</legend>
                    <label className={web ? "" : "grid gap-1 text-xs"}>
                      Name as on the ID
                      <input
                        required
                        className={web ? "" : "field"}
                        value={person.name}
                        onChange={(event) => setPeople((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
                      />
                    </label>
                    <div>
                      <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>Date of birth</p>
                      <p className={web ? "web-note" : "text-[0.65rem] text-[var(--muted)]"}>Required by airlines.</p>
                      <DobWheel
                        light={web}
                        value={person.birthday}
                        onChange={(birthday) => setPeople((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, birthday } : item))}
                      />
                    </div>
                    <div className={web ? "web-genders" : "flex gap-2"}>
                      {[["M", "Male"], ["F", "Female"]].map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          className={person.gender === id ? (web ? "is-on" : "rounded-full bg-[var(--ink)] px-4 py-2 text-xs") : (web ? "" : "rounded-full border border-[var(--line)] px-4 py-2 text-xs")}
                          onClick={() => setPeople((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, gender: id } : item))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <label className={web ? "" : "grid gap-1 text-xs"}>
                  Email for the confirmation
                  <input required type="email" className={web ? "" : "field"} value={traveler.email} onChange={(event) => setTraveler({ ...traveler, email: event.target.value })} />
                </label>
                <label className={web ? "" : "grid gap-1 text-xs"}>
                  Phone
                  <input required inputMode="numeric" className={web ? "" : "field"} value={traveler.phone} onChange={(event) => setTraveler({ ...traveler, phone: event.target.value })} />
                </label>
                <label className={web ? "" : "grid gap-1 text-xs"}>
                  Passport number, if this route asks for it
                  <input className={web ? "" : "field"} value={traveler.documentNumber} onChange={(event) => setTraveler({ ...traveler, documentNumber: event.target.value })} />
                </label>
                <div className={web ? "web-sheet-actions" : "mt-2 flex justify-between"}>
                  <button type="button" className={web ? "web-text-btn" : "text-xs"} onClick={() => setStep("fare")}>Back</button>
                  <button type="submit" disabled={busy} className={web ? "web-next" : "rounded-full bg-[var(--gold)] px-4 py-2 text-sm text-black disabled:opacity-50"}>
                    {busy ? "Holding the fare…" : "Continue"}
                  </button>
                </div>
              </form>
            ) : null}

            {step === "bags" ? (
              <div>
                <div className={web ? "web-seat-head" : "flex items-baseline justify-between gap-3"}>
                  <p className={web ? "" : "text-sm"}>Seats and bags</p>
                  <p className={web ? "web-note" : "text-[0.7rem] text-[var(--muted)]"}>
                    {orderedRows.length ? `${openSeats} selectable seats` : "No seat map for this fare"}
                  </p>
                </div>
                {fare?.baggage?.length ? (
                  <p className={web ? "web-note" : "mt-1 text-xs text-[var(--muted)]"}>{fare.baggage.join(" · ")}</p>
                ) : null}
                {orderedRows.length ? (
                <div className={web ? "web-legend" : "mt-2 flex flex-wrap gap-3 text-[0.65rem] text-[var(--muted)]"}>
                  <span><i className={web ? "is-seat" : "mr-1 inline-block h-3 w-3 rounded-sm bg-white/80"} /> Standard</span>
                  <span><i className={web ? "is-exit" : "mr-1 inline-block h-3 w-3 rounded-sm bg-emerald-200"} /> Exit row</span>
                  <span><i className={web ? "is-taken" : "mr-1 inline-block h-3 w-3 rounded-sm bg-white/25"} /> Already booked</span>
                </div>
                ) : null}
                {orderedRows.length ? (
                  <div className={web ? "web-cabin" : "mt-3 max-h-80 overflow-auto rounded-2xl border border-[var(--line)] px-2 py-3"}>
                    <div className={web ? "web-cabin-row is-letters" : "mb-2 grid items-center justify-center gap-1.5 text-center text-[0.65rem] text-[var(--muted)]"} style={{ gridTemplateColumns: cabin.template }}>
                      <span />
                      {cabin.columns.map((column) => (
                        <span key={column} style={{ display: "contents" }}>
                          {cabin.aisleBefore.has(column) ? <span /> : null}
                          <span>{column}</span>
                        </span>
                      ))}
                    </div>
                    {orderedRows.map(([row, items]) => {
                      const byColumn = new Map(items.map((item) => [item.column, item]));
                      return (
                        <div key={row} className={web ? "web-cabin-row" : "mt-1.5 grid items-center justify-center gap-1.5"} style={{ gridTemplateColumns: cabin.template }}>
                          <span className={web ? "web-row-no" : "text-[0.65rem] text-[var(--muted)]"}>{row}</span>
                          {cabin.columns.map((column) => {
                            const item = byColumn.get(column);
                            const chosenSeat = item && item.available && seat?.serviceId === item.serviceId;
                            const tone = !item
                              ? (web ? "web-seat is-empty" : "h-7 w-7 rounded-[7px] border border-dashed border-[var(--line)]")
                              : !item.available
                                ? (web ? "web-seat is-taken" : "h-7 w-7 cursor-not-allowed rounded-[7px] bg-white/20")
                                : chosenSeat
                                  ? (web ? "web-seat is-on" : "h-7 w-7 rounded-[7px] bg-[var(--gold)]")
                                  : item.kind === "exit_row"
                                    ? (web ? "web-seat is-exit" : "h-7 w-7 rounded-[7px] bg-emerald-200")
                                    : (web ? "web-seat" : "h-7 w-7 rounded-[7px] bg-white/80");
                            return (
                              <span key={column} style={{ display: "contents" }}>
                                {cabin.aisleBefore.has(column) ? <span /> : null}
                                {item ? (
                                  <button
                                    type="button"
                                    disabled={!item.available}
                                    aria-label={item.available ? `Seat ${item.number}${item.price ? `, ${money(item.price, item.currency)}` : ""}` : `Seat ${item.number} is already booked`}
                                    title={item.available ? (item.price ? `${item.number} · ${money(item.price, item.currency)}` : item.number) : `${item.number} already booked`}
                                    className={tone}
                                    onClick={() => item.available && setSeat(chosenSeat ? null : item)}
                                  />
                                ) : (
                                  <span className={tone} />
                                )}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {orderedRows.length || seat ? (
                  <p className={web ? "web-seat-pick" : "mt-3 text-sm"}>
                    {seat
                      ? `Seat ${seat.number}${seat.price ? ` · ${money(seat.price, seat.currency)}` : ""}`
                      : "Tap an open seat, or continue without one. Booked seats cannot be selected."}
                  </p>
                ) : (
                  <p className={web ? "web-note" : "mt-3 text-sm text-[var(--muted)]"}>
                    {held?.extras?.length
                      ? "This fare has no seats to choose. Continue to review, or add a bag below."
                      : "This fare has no seats to choose. Continue to review."}
                  </p>
                )}
                {held?.extras?.length ? (
                  <div className={web ? "web-extras" : "mt-4 grid gap-2"}>
                    <p className={web ? "" : "text-sm"}>Extra bags</p>
                    {held.extras.map((item) => (
                      <button
                        key={item.serviceId}
                        type="button"
                        className={extra?.serviceId === item.serviceId ? (web ? "web-extra is-on" : "flex items-center justify-between rounded-2xl border border-[var(--gold)] px-3 py-2 text-left text-sm") : (web ? "web-extra" : "flex items-center justify-between rounded-2xl border border-[var(--line)] px-3 py-2 text-left text-sm")}
                        onClick={() => setExtra(extra?.serviceId === item.serviceId ? null : item)}
                      >
                        <span>{item.name}</span>
                        <span>+ {money(item.price, item.currency)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className={web ? "web-sheet-actions" : "mt-4 flex justify-between"}>
                  <button type="button" className={web ? "web-text-btn" : "text-xs"} onClick={() => setStep("traveler")}>Back</button>
                  <button type="button" disabled={busy} className={web ? "web-next" : "rounded-full bg-[var(--gold)] px-4 py-2 text-sm text-black disabled:opacity-50"} onClick={keepSeat}>
                    {busy ? "Adding the seat…" : "Continue to review"}
                  </button>
                </div>
              </div>
            ) : null}

            {step === "review" ? (
              <div>
                <ReviewBody
                  web={web}
                  people={people}
                  partyCount={partyCount}
                  traveler={traveler}
                  fare={fare}
                  held={held}
                  seat={seat}
                  extra={extra}
                  travelDate={travelDate}
                />
                <div className={web ? "web-sheet-actions" : "mt-4 flex justify-between"}>
                  <button type="button" className={web ? "web-text-btn" : "text-xs"} onClick={() => setStep(held?.seats?.length || held?.extras?.length ? "bags" : "traveler")}>Back</button>
                  <button type="button" className={web ? "web-next" : "rounded-full bg-[var(--gold)] px-4 py-2 text-sm text-black"} onClick={() => setStep("pay")}>
                    Open secure payment →
                  </button>
                </div>
              </div>
            ) : null}

            {step === "pay" ? (
              <div>
                <p className={web ? "" : "text-sm"}>Pay securely</p>
                <p className={web ? "web-note" : "mt-1 text-xs text-[var(--muted)]"}>
                  The card goes straight to the booking partner. {money(held?.total || fare?.price?.total, held?.currency || fare?.price?.currency)} is the amount they will request.
                </p>
                {String(held?.publicKey || "").startsWith("pk_") ? (
                  <div id="safar-card" className={web ? "web-card-box" : "mt-4 rounded-2xl border border-[var(--line)] bg-white p-3"} />
                ) : (
                  <div id="safar-pay" className={web ? "web-card-box" : "safar-pay mt-4 rounded-2xl bg-white p-3"} />
                )}
                {status?.sandbox ? (
                  <p className={web ? "web-note" : "mt-2 text-[0.7rem] text-[var(--muted)]"}>
                    Sandbox test card 4242 4242 4242 4242, any future date, any CVC. This does not buy a real ticket.
                  </p>
                ) : null}
                <div className={web ? "web-sheet-actions" : "sticky bottom-0 mt-4 flex items-center justify-between gap-3 bg-[var(--paper)] py-3"}>
                  <button type="button" className={web ? "web-text-btn" : "text-xs"} onClick={() => setStep("review")}>Back</button>
                  <button
                    type="button"
                    disabled={busy}
                    className={web ? "web-next" : "rounded-full bg-[var(--gold)] px-5 py-3 text-sm font-medium text-black disabled:opacity-50"}
                    onClick={String(held?.publicKey || "").startsWith("pk_") ? pay : payWithPartner}
                  >
                    {busy ? "Confirming…" : `Pay ${money(held?.total || fare?.price?.total, held?.currency || fare?.price?.currency)}`}
                  </button>
                </div>
              </div>
            ) : null}

            {step === "done" && ticket ? (
              <div>
                <p className={web ? "" : "text-sm"}>Booking reference {ticket.bookingRef || ticket.bookingId}</p>
                <p className={web ? "web-note" : "mt-1 text-xs text-[var(--muted)]"}>
                  {ticket.airlinePnr ? `Airline code ${ticket.airlinePnr}. ` : "The airline code appears here when the booking is confirmed. "}
                  It stays on this chat.
                  {ticket.sandbox ? " This is a sandbox booking, not a real ticket." : ""}
                </p>
                <div className={web ? "web-sheet-actions" : "mt-4 flex justify-end"}>
                  <button type="button" className={web ? "web-next" : "rounded-full bg-[var(--gold)] px-4 py-2 text-sm text-black"} onClick={() => { setChosen(null); setStep(""); }}>
                    Done
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
