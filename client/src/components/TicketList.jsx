import { useEffect, useState } from "react";
import { listTickets } from "../lib/api.js";
import { formatDay } from "../lib/dates.js";

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

function statusLabel(status) {
  const text = String(status || "").toLowerCase();
  if (!text) return "Saved";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function TicketList({ variant = "app" }) {
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState("");
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

  return (
    <section className={web ? "web-tickets" : "mt-6"}>
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
          <article key={ticket.bookingId || ticket.bookedAt} className={web ? "web-ticket" : "card rounded-[1.4rem] px-4 py-4"}>
            <div className={web ? "web-flight-top" : "flex items-start justify-between gap-3"}>
              <p className={web ? "web-note" : "text-xs text-[var(--gold)]"}>{ticket.sandbox ? "Test booking" : "Ticket"}</p>
              <p className={web ? "" : "text-xs text-[var(--cream)]"}>{statusLabel(ticket.status)}</p>
            </div>
            <h2 className={web ? "web-ticket-route" : "serif mt-2 text-2xl font-semibold leading-tight"}>
              {ticket.from || "—"} → {ticket.to || "—"}
            </h2>
            <p className="mt-1 text-sm">
              {ticket.airline || "Flight"}
              {ticket.flight ? ` · ${ticket.flight}` : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {formatDay(ticket.date)}
              {ticket.depart ? ` · ${ticket.depart}` : ""}
              {ticket.arrive ? `–${ticket.arrive}` : ""}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <TicketRow label="Booking reference" value={ticket.bookingRef || "Not back yet"} />
              <TicketRow label="Airline code" value={ticket.airlinePnr || "Not assigned yet"} />
              {ticket.name ? <TicketRow label="Traveler" value={ticket.name} /> : null}
              {money(ticket.total, ticket.currency) ? (
                <TicketRow label="Paid to partner" value={money(ticket.total, ticket.currency)} />
              ) : null}
            </dl>
            <p className="mt-3 text-xs text-[var(--muted)]">
              {ticket.sandbox
                ? "Nuitee confirmed this test. It is not a real airline ticket and will not appear in the airline app."
                : ticket.airlinePnr
                  ? "This is your ticket. Check in with the airline code."
                  : "The booking partner confirmed this. The airline code appears here when the airline assigns it."}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function TicketRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
