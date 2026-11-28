import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cancelTicket, downloadTicketConfirmation, getTicketDetail, listTickets, quoteTicketCancellation } from "../lib/api.js";
import { formatDay } from "../lib/dates.js";
import { StayList } from "./HotelBook.jsx";
import "./site/try.css";

function money(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  if (!currency) return String(amount);
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

function statusLabel(status) {
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "CANCELLED_WITH_CHARGES") return "Cancelled with charges";
  const text = String(status || "").trim();
  if (!text) return "Saved";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function cancelled(ticket) {
  return ticket.status === "CANCELLED" || ticket.status === "CANCELLED_WITH_CHARGES";
}

function destinationText(value) {
  if (value === "original_payment") return "Any refund goes back to the card charged by the booking partner.";
  if (value === "agency_deposit") return "Any refund stays with the booking partner.";
  if (value === "voucher") return "The airline may issue a voucher instead of cash.";
  if (value === "bsp_settlement") return "The refund is settled between the booking partner and the airline.";
  if (value === "manual") return "The booking partner handles the refund outside this screen.";
  return "";
}

function ticketNote(ticket) {
  if (cancelled(ticket)) return "This ticket is cancelled. Any refund comes from the booking partner.";
  if (ticket.cancellation?.pending) return "Cancellation sent. The ticket stays confirmed until the airline finishes. Open Tickets again to see the result.";
  if (ticket.sandbox) return "Nuitee confirmed this test. It is not a real airline ticket and will not appear in the airline app.";
  if (ticket.airlinePnr) return "This is your ticket. Check in with the airline code.";
  return "The booking partner confirmed this. The airline code appears here when the airline assigns it.";
}

function clock(iso) {
  const match = String(iso || "").match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function duration(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return "";
  const hours = Math.floor(n / 60);
  const rest = n % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

function genderLabel(value) {
  if (value === "M") return "Male";
  if (value === "F") return "Female";
  return value || "";
}

function bagLine(bag) {
  const bits = [];
  if (bag.pieces) bits.push(`${bag.pieces} ×`);
  if (bag.name) bits.push(bag.name);
  if (bag.weightKg) bits.push(`${bag.weightKg} kg`);
  const text = bits.join(" ");
  return bag.size ? `${text} · ${bag.size}` : text;
}

function flightNo(segment) {
  const raw = String(segment.number || "").trim();
  const code = String(segment.code || "").trim();
  if (code && raw.toUpperCase().startsWith(code)) return raw.slice(code.length).trim();
  return raw;
}

function bagKind(bag) {
  const name = String(bag.name || "").toLowerCase();
  if (/carry|cabin|hand/.test(name)) return "carry-on";
  if (/check/.test(name)) return "checked baggage";
  return "";
}

function bagCardLabel(bag) {
  const kind = bagKind(bag);
  if (!kind) return bagLine(bag);
  const count = bag.pieces ? `${bag.pieces} ` : "";
  const weight = bag.weightKg ? ` · ${bag.weightKg} kg` : "";
  return `${count}${kind}${weight}`;
}

function storedLegs(ticket) {
  if (ticket.segments?.length) return ticket.segments;
  return [{
    airline: ticket.airline || "",
    number: ticket.flight || "",
    from: ticket.from || "",
    to: ticket.to || "",
    departAt: ticket.date && ticket.depart ? `${ticket.date}T${ticket.depart}` : (ticket.date || ""),
    arriveAt: ticket.date && ticket.arrive ? `${ticket.date}T${ticket.arrive}` : "",
  }];
}

function placeLine(name, code) {
  if (name && code) return `${name} (${code})`;
  return name || code || "";
}

function FlyingPlane() {
  return (
    <span className="web-leg-sky" aria-hidden="true">
      <span className="web-leg-rail" />
      <span className="web-leg-dot web-leg-dot-from" />
      <span className="web-leg-dot web-leg-dot-to" />
      <svg className="web-leg-plane" viewBox="0 0 70 28">
        <g transform="translate(70 0) scale(-1 1)">
          <path d="M4 14c0-1.8 2.2-3 6-3h16l8-7.5h4.5L32.5 11H52l6-4.5h4l-5 7.2 9 .8-9 .8 5 7.2h-4L52 17H32.5L38.5 24.5H34L26 17H10c-3.8 0-6-1.2-6-3z" />
        </g>
      </svg>
    </span>
  );
}

function BagGlyph({ kind }) {
  const carry = kind === "carry-on";
  return (
    <svg className="web-leg-glyph" viewBox="0 0 24 24" aria-hidden="true">
      {carry ? (
        <path d="M9 8h6a1 1 0 0 1 1 1v8H8V9a1 1 0 0 1 1-1zm1.2-2.2h3.6V8h-3.6V5.8z" />
      ) : (
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7h2a1 1 0 0 1 1 1v9.5a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h2zm1.4-1.5h3.2V7h-3.2V5.5zM8 12h8v1.2H8V12z" />
      )}
    </svg>
  );
}

export function FlightLeg({ segment, bags }) {
  const number = flightNo(segment);
  const departDay = formatDay(String(segment.departAt || "").slice(0, 10));
  const arriveDay = formatDay(String(segment.arriveAt || "").slice(0, 10));
  const from = placeLine(segment.fromName, segment.from);
  const to = placeLine(segment.toName, segment.to);
  const minutes = duration(segment.minutes);
  return (
    <section className="web-leg">
      <header className="web-leg-head">
        {segment.logo ? (
          <img className="web-leg-logo" src={segment.logo} alt="" />
        ) : (
          <span className="web-airline-mark">{(segment.code || segment.airline || "A").slice(0, 2)}</span>
        )}
        <div>
          {segment.airline ? <p className="web-leg-airline">{segment.airline}</p> : null}
          {number ? <p className="web-leg-number">{number}</p> : null}
        </div>
      </header>
      <div className="web-leg-route">
        <p className="web-leg-place">{from}</p>
        <FlyingPlane />
        <p className="web-leg-place web-leg-to">{to}</p>
        <p className="web-leg-day">{departDay}</p>
        <p className="web-leg-dur">{minutes}</p>
        <p className="web-leg-day web-leg-to">{arriveDay}</p>
        <p className="web-leg-time">{clock(segment.departAt) || "—"}</p>
        <span className="web-leg-gap" />
        <p className="web-leg-time web-leg-to">{clock(segment.arriveAt) || "—"}</p>
      </div>
      {bags?.length ? (
        <ul className="web-leg-bags">
          {bags.map((bag, index) => (
            <li key={`${bagCardLabel(bag)}-${index}`} title={bagLine(bag)}>
              <BagGlyph kind={bagKind(bag)} />
              <span>{bagCardLabel(bag)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function TicketList({ variant = "app" }) {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState("");
  const web = variant === "web";

  useEffect(() => {
    let cancel = false;
    listTickets()
      .then((rows) => {
        if (!cancel) setTickets(rows);
      })
      .catch((err) => {
        if (!cancel) setError(err.message || "Tickets could not be loaded.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const replaceTicket = (next) => {
    if (!next) return;
    setTickets((rows) => (rows || []).map((item) => (item.bookingId === next.bookingId ? next : item)));
  };

  return (
    <section className={web ? "web-tickets" : "mt-6"}>
      <StayList />
      <p className={web ? "web-kicker" : "kicker"}>Tickets</p>
      {error ? <p className={web ? "web-error" : "mt-3 text-sm text-[var(--rose)]"}>{error}</p> : null}
      {tickets == null && !error ? <p className={web ? "web-note" : "mt-3 text-sm text-[var(--muted)]"}>Checking your tickets…</p> : null}
      {tickets && !tickets.length ? (
        <p className={web ? "web-note" : "mt-3 text-sm text-[var(--muted)]"}>
          Finished bookings appear here. A test stays labeled Test. A live booking shows the airline code you check in with.
        </p>
      ) : null}
      <div className={web ? "" : "mt-3 space-y-3"}>
        {(tickets || []).map((ticket) => (
          <article key={ticket.bookingId || ticket.bookedAt} className={web ? "web-ticket-card" : "card rounded-[1.4rem] px-4 py-4"}>
            <button type="button" className="web-ticket-open" onClick={() => ticket.bookingId && setOpenId(ticket.bookingId)}>
            <div className={web ? "web-ticket-card-head" : "flex items-start justify-between gap-3"}>
              <p className={web ? "web-ticket-chip" : "text-xs text-[var(--gold)]"}>{ticket.sandbox ? "Test booking" : "Ticket"}</p>
              <p className={web ? `web-ticket-pill ${cancelled(ticket) ? "is-cancelled" : ticket.cancellation?.pending ? "is-pending" : "is-confirmed"}` : "text-xs text-[var(--cream)]"}>{statusLabel(ticket.status)}</p>
            </div>
            {web ? storedLegs(ticket).map((segment) => (
              <FlightLeg
                key={`${segment.number || segment.from}-${segment.departAt}`}
                segment={segment}
                bags={ticket.bags}
              />
            )) : (
              <>
                <h2 className="serif mt-2 text-2xl font-semibold leading-tight">{ticket.from || "—"} → {ticket.to || "—"}</h2>
                <p className="mt-1 text-sm">{ticket.airline || "Flight"}{ticket.flight ? ` · ${ticket.flight}` : ""}</p>
              </>
            )}
            {web && ticket.airlinePnr ? (
              <p className="web-ticket-foot"><span>Airline code</span><strong>{ticket.airlinePnr}</strong></p>
            ) : null}
            {web && ticket.cancellation?.pending ? <p className="web-ticket-pending">Cancellation in progress</p> : null}
            {!web && destinationText(ticket.cancellation?.destination) ? (
              <p className="mt-3 text-xs text-[var(--muted)]">{destinationText(ticket.cancellation.destination)}</p>
            ) : null}
            {!web ? <p className="mt-3 text-xs text-[var(--muted)]">{ticketNote(ticket)}</p> : null}
            </button>
            {openId && openId === ticket.bookingId ? (
              <TicketDetail ticket={ticket} onClose={() => setOpenId("")} onDone={replaceTicket} />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function TicketDetail({ ticket, onClose, onDone }) {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const anchor = useState(() => (typeof document === "undefined" ? null : document.querySelector(".flight-ui")))[0];

  useEffect(() => {
    let cancel = false;
    getTicketDetail(ticket.bookingId)
      .then((next) => {
        if (!cancel) setPayload(next);
      })
      .catch((err) => {
        if (!cancel) setError(err.message || "This ticket could not be opened.");
      });
    return () => {
      cancel = true;
    };
  }, [ticket.bookingId]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const detail = payload?.detail;
  const segments = detail?.segments || [];
  const price = detail?.price;
  const lines = [
    price?.base != null ? ["Fare", price.base] : null,
    price?.taxes != null ? ["Taxes", price.taxes] : null,
    price?.fees != null ? ["Fees", price.fees] : null,
    price?.total != null ? ["Total", price.total] : null,
  ].filter(Boolean);
  const phone = Boolean(anchor);
  const airline = segments.find((segment) => segment.airline)?.airline || ticket.airline || "the airline";
  const pnr = detail?.airlinePnr || ticket.airlinePnr || "";
  const sandbox = Boolean(ticket.sandbox || payload?.sandbox);

  const saveConfirmation = async () => {
    setSaveError("");
    setSaving(true);
    try {
      await downloadTicketConfirmation(ticket.bookingId);
    } catch (err) {
      setSaveError(err.message || "The confirmation could not be prepared.");
    } finally {
      setSaving(false);
    }
  };

  const sheet = (
    <div className={phone ? "flight-ui is-phone" : undefined}>
      <div className="web-sheet" role="dialog" aria-modal="true" aria-label="Ticket" onClick={onClose}>
        <div className="web-sheet-card web-ticket-detail" onClick={(event) => event.stopPropagation()}>
          <div className="web-sheet-head">
            <p>{ticket.sandbox || payload?.sandbox ? "Test booking" : "Ticket"}</p>
            <button type="button" className="web-text-btn" onClick={onClose}>Close</button>
          </div>
          <div className="web-sheet-scroll">
            {error ? <p className="web-error">{error}</p> : null}
            {!payload && !error ? <p className="web-note">Opening this ticket…</p> : null}
            {payload?.unavailable ? <p className="web-note">{payload.unavailable}</p> : null}
            {detail?.cancelPending || ticket.cancellation?.pending ? (
              <p className="web-note">Cancellation in progress. The booking stays confirmed until the airline finishes.</p>
            ) : null}
            <p className="web-ticket-status">{statusLabel(detail?.status || ticket.status)}</p>
            {detail && pnr ? (
              <div className="web-checkin">
                <p>Airline code</p>
                <strong>{pnr}</strong>
                <p>Check in with {airline} using this code. {airline} issues the boarding pass the airport scans.</p>
                {sandbox ? <p>This is a test booking. The airline will not issue a boarding pass for it.</p> : null}
              </div>
            ) : null}
            {detail && !pnr ? (
              <p className="web-note">The airline code appears here when the airline assigns it. Check-in uses that code.</p>
            ) : null}
            {segments.length ? segments.map((segment) => (
              <FlightLeg
                key={`${segment.number || segment.from}-${segment.departAt}`}
                segment={segment}
                bags={detail?.bags}
              />
            )) : (
              <h2 className="web-ticket-route">{ticket.from || "—"} → {ticket.to || "—"}</h2>
            )}
            {detail?.cabin || detail?.family ? (
              <p className="web-note">{[detail.cabin, detail.family].filter(Boolean).join(" · ")}</p>
            ) : null}
            {lines.length || detail?.extras?.length || detail?.paid ? (
              <dl className="web-ticket-money">
                {lines.filter(([label]) => label !== "Total").map(([label, amount]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{money(amount, price.currency)}</dd>
                  </div>
                ))}
                {(detail?.extras || []).map((extra) => (
                  <div key={`${extra.name}-${extra.amount}`}>
                    <dt>{extra.name || "Extra"}</dt>
                    <dd>{money(extra.amount, extra.currency || price?.currency)}</dd>
                  </div>
                ))}
                {detail?.paid ? (
                  <div className="is-total">
                    <dt>Paid</dt>
                    <dd>{money(detail.paid.amount, detail.paid.currency || price?.currency)}</dd>
                  </div>
                ) : price?.total != null ? (
                  <div className="is-total">
                    <dt>Total</dt>
                    <dd>{money(price.total, price.currency)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {detail?.terms?.length ? (
              <ul className="web-ticket-terms">
                {detail.terms.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : null}
            {detail?.passengers?.length ? detail.passengers.map((person) => (
              <p className="web-ticket-person" key={`${person.name}-${person.birthday}`}>
                <strong>{person.name}</strong>
                {genderLabel(person.gender) ? ` · ${genderLabel(person.gender)}` : ""}
                {person.birthday ? ` · ${formatDay(person.birthday)}` : ""}
                {person.nationality ? ` · ${person.nationality}` : ""}
              </p>
            )) : null}
            {detail?.contact?.email || detail?.contact?.phone ? (
              <p className="web-note">
                {[detail.contact.email, detail.contact.phone].filter(Boolean).join(" · ")}
              </p>
            ) : null}
            <dl className="web-ticket-money">
              <div>
                <dt>Booking reference</dt>
                <dd>{detail?.bookingRef || ticket.bookingRef || "Not back yet"}</dd>
              </div>
            </dl>
            {detail && !payload?.unavailable ? (
              <button type="button" className="web-ticket-download" disabled={saving} onClick={saveConfirmation}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" />
                </svg>
                {saving ? "Preparing ticket…" : "Download ticket"}
              </button>
            ) : null}
            {saveError ? <p className="web-error">{saveError}</p> : null}
            {ticket.bookingId && !cancelled({ status: detail?.status || ticket.status }) && !detail?.cancelPending && !ticket.cancellation?.pending ? (
              <CancelTicket ticket={ticket} onDone={onDone} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return phone ? createPortal(sheet, document.body) : sheet;
}

function CancelTicket({ ticket, onDone }) {
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const ask = async () => {
    setError("");
    setBusy("quote");
    try {
      setQuote(await quoteTicketCancellation(ticket.bookingId));
      setOpen(true);
    } catch (err) {
      setError(err.message || "The booking partner did not return a cancellation quote. The ticket is unchanged.");
    } finally {
      setBusy("");
    }
  };

  const confirm = async () => {
    setError("");
    setBusy("cancel");
    try {
      const next = await cancelTicket(ticket.bookingId);
      setOpen(false);
      onDone(next);
    } catch (err) {
      setError(err.message || "The ticket was not cancelled. It is still confirmed.");
    } finally {
      setBusy("");
    }
  };

  const estimate = quote?.confidence && quote.confidence !== "confirmed"
    ? "The booking partner marked this figure as an estimate."
    : "";

  return (
    <div className="web-cancel">
      {error ? <p className="web-error">{error}</p> : null}
      {!open ? (
        <div className="web-cancel-actions">
          <button type="button" className="web-text-btn" disabled={Boolean(busy)} onClick={ask}>
            {busy === "quote" ? "Checking the refund…" : "Cancel ticket"}
          </button>
        </div>
      ) : (
        <>
          <p>Cancel this ticket? The booking partner sends any refund. The final amount can be lower than the quote.</p>
          {quote?.voidable ? <p>The booking partner marked this as cancellable without a penalty.</p> : null}
          {quote?.refundable === true ? <p>The booking partner marked this fare as refundable.</p> : null}
          {quote?.refundable === false && !quote?.voidable ? <p>The booking partner marked this fare as not refundable.</p> : null}
          {quote?.refund ? <p>Potential refund {money(quote.refund.amount, quote.refund.currency) || quote.refund.amount}</p> : null}
          {quote?.penalties?.length ? quote.penalties.map((item) => (
            <p key={`${item.name || "penalty"}-${item.amount}`}>{item.name ? `${item.name} ` : "Penalty "}{money(item.amount, item.currency) || (item.amount != null ? item.amount : "")}</p>
          )) : quote?.penalty ? <p>Penalty {money(quote.penalty.amount, quote.penalty.currency) || quote.penalty.amount}</p> : null}
          {(quote?.vouchers || []).map((item) => (
            <p key={`${item.name || "voucher"}-${item.amount}`}>Voucher {item.name ? `${item.name} ` : ""}{money(item.amount, item.currency) || (item.amount != null ? item.amount : "")}</p>
          ))}
          {estimate ? <p>{estimate}</p> : null}
          {!quote?.refund && !quote?.penalty && !quote?.penalties?.length ? <p>The booking partner did not return a refund amount. The ticket is unchanged until you confirm.</p> : null}
          {destinationText(quote?.destination) ? <p>{destinationText(quote.destination)}</p> : null}
          {ticket.sandbox ? <p>This is a test booking. Cancelling it does not change a real ticket.</p> : null}
          <div className="web-cancel-actions">
            <button type="button" className="web-text-btn" disabled={Boolean(busy)} onClick={() => { setOpen(false); setError(""); }}>
              Keep ticket
            </button>
            <button type="button" className="web-flight-book" disabled={Boolean(busy)} onClick={confirm}>
              {busy === "cancel" ? "Cancelling…" : "Cancel ticket"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
