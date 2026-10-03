import { useEffect, useRef, useState } from "react";
import { suggestFlights } from "../lib/api.js";
import { formatTripSpan } from "../lib/dates.js";
import { buildJourney } from "../lib/transport.js";
import { dayNumber, dayVisitItems } from "../lib/tripChecks.js";
import { CheckRow } from "./CheckRow.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { WeatherStrip } from "./PlacePicker.jsx";
import { StayChoices } from "./StayChoices.jsx";
import { TransportBoard } from "./Transport.jsx";

export function ItineraryView({
  plan,
  weather,
  journey,
  showDates = true,
  visited,
  onToggleVisit,
  onRequestDay,
  onKeepDay,
  todayIndex = null,
  stays = [],
  onToggleStay,
  onFlightPicks,
}) {
  const savePicks = useRef(onFlightPicks);
  savePicks.current = onFlightPicks;
  const [localPicks, setLocalPicks] = useState(null);
  const [pickError, setPickError] = useState("");
  const wantsFlights = Boolean(journey?.modes?.includes?.("flight"));
  const hasSavedPicks = Array.isArray(journey?.flightPicks);
  const flightPicks = hasSavedPicks ? journey.flightPicks : localPicks;
  const from = journey?.from || "";
  const to = journey?.to || "";
  const date = journey?.date || "";
  const adults = journey?.adults || 1;
  const kids = journey?.kids || 0;
  const currency = journey?.currency || journey?.profile?.currency || "";

  useEffect(() => {
    if (!wantsFlights || hasSavedPicks || !from || !to) return undefined;
    let cancel = false;
    setPickError("");
    suggestFlights({ from, to, date, adults, kids, currency, profile: journey?.profile })
      .then((picks) => {
        if (cancel) return;
        const next = Array.isArray(picks) ? picks.slice(0, 3) : [];
        if (savePicks.current) savePicks.current(next);
        else setLocalPicks(next);
      })
      .catch((err) => {
        if (!cancel) setPickError(err.message || "Could not choose flights for this date.");
      });
    return () => {
      cancel = true;
    };
  }, [wantsFlights, hasSavedPicks, from, to, date, adults, kids, currency, journey?.profile]);

  if (!plan) return null;
  const board = buildJourney(flightPicks ? { ...journey, flightPicks } : journey);
  const budgetEntries = Object.entries(plan.budget || {}).filter(([, v]) => v);
  const span = formatTripSpan(plan.startDate, plan.daysCount) || plan.duration;

  return (
    <div>
      {plan.summary && <p className="mt-4 text-[0.95rem] leading-relaxed text-[#d8d2c6]">{plan.summary}</p>}
      {showDates && (span || plan.bestTime) ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          {span}
          {plan.bestTime ? ` · Best ${plan.bestTime}` : ""}
        </p>
      ) : null}
      {pickError ? <p className="mt-4 text-sm text-[var(--rose)]">{pickError}</p> : null}
      {board && <TransportBoard board={board} />}
      {weather && (
        <div className="mt-4">
          <WeatherStrip weather={weather} />
        </div>
      )}

      {budgetEntries.length > 0 && (
        <section className="card mt-6 rounded-[1.4rem] p-4">
          <p className="kicker">Expenses</p>
          <p className="mt-1 text-[0.7rem] text-[var(--muted)]">Estimates. Live prices open on Booking or airline sites.</p>
          <div className="mt-3 space-y-2">
            {budgetEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 text-sm">
                <span className="capitalize text-[var(--muted)]">{key}</span>
                <span className="text-right text-[#f0e8da]">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <VisaBlock visa={plan.visa} />

      <section className="mt-7">
        <h2 className="serif text-2xl font-semibold">Stay</h2>
        <div className="mt-3">
          <StayChoices
            selected={stays}
            onToggle={onToggleStay}
            destination={plan.destination}
            startDate={plan.startDate}
            endDate={plan.endDate}
            adults={journey?.adults}
            showSearch
          />
        </div>
      </section>

      {plan.days?.length > 0 && (
        <section className="mt-7">
          <h2 className="serif text-2xl font-semibold">Days</h2>
          <div className="mt-3 space-y-3">
            {plan.days.map((day, index) => (
              <DayArticle
                key={`${day.day}-${index}`}
                day={day}
                index={index}
                today={todayIndex === index}
                visited={visited}
                onToggleVisit={onToggleVisit}
                onRequestDay={onRequestDay}
                onKeepDay={onKeepDay}
              />
            ))}
          </div>
        </section>
      )}

      {plan.food?.length > 0 && <BulletBlock title="Taste" items={plan.food} />}
      {plan.packing?.length > 0 && <BulletBlock title="Pack" items={plan.packing} />}
      {plan.tips?.length > 0 && <BulletBlock title="Concierge notes" items={plan.tips} />}
      {plan.safety && (
        <section className="card mt-3 rounded-[1.3rem] p-4">
          <p className="kicker">Safety</p>
          <p className="mt-2 text-sm leading-relaxed text-[#d8d2c6]">{plan.safety}</p>
        </section>
      )}
      <p className="mt-6 text-[0.65rem] leading-relaxed text-[var(--muted)]">
        AI-generated. Check visas, prices, and opening hours before you travel.
      </p>
    </div>
  );
}

function VisaBlock({ visa }) {
  if (!visa) return null;
  const text = typeof visa === "string" ? visa : [visa.youApply, visa.type, visa.timeline].filter(Boolean).join(" ");
  return (
    <section className="card mt-6 rounded-[1.3rem] p-4">
      <p className="kicker">Visa (you apply)</p>
      <p className="mt-2 text-sm leading-relaxed text-[#d8d2c6]">{text}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Safar explains the steps. You file on the official site. We do not collect documents or guarantee approval.
      </p>
    </section>
  );
}

function DayArticle({ day, index, today, visited, onToggleVisit, onRequestDay, onKeepDay }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState(null);
  const number = dayNumber(day, index);
  const parts = onToggleVisit ? dayVisitItems(day, index) : [];
  const saved = Boolean(onRequestDay);

  const rewrite = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await onRequestDay(day, index, comment);
      setProposal(next);
    } catch (err) {
      setError(err.message || "This day stayed as it was.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="card rounded-[1.3rem] p-4">
      <p className="kicker">{today ? "Today" : `Day ${number}`}</p>
      <h3 className="serif mt-1 text-xl font-semibold">{day.title}</h3>
      {parts.length > 0
        ? parts.map((item) => (
            <CheckRow
              key={item.id}
              checked={Boolean(visited?.[item.id])}
              label={item.text}
              detail={item.label}
              onToggle={() => onToggleVisit(item.id)}
            />
          ))
        : (
          <>
            <DayLine label="Morning" text={day.morning} />
            <DayLine label="Afternoon" text={day.afternoon} />
            <DayLine label="Evening" text={day.evening} />
            {day.food ? <DayLine label="Food" text={day.food} /> : null}
          </>
        )}
      {day.cost ? <p className="mt-2 text-xs text-[var(--gold)]">{day.cost}</p> : null}

      {saved && (
        <div className="mt-3 border-t border-[var(--line)] pt-3">
          {!open && !busy && (
            <button type="button" className="min-h-11 text-sm text-[var(--gold)]" onClick={() => setOpen(true)}>
              Redo this day
            </button>
          )}
          {open && !busy && (
            <div>
              <label className="text-[0.7rem] tracking-wide text-[var(--muted)] uppercase" htmlFor={`redo-${number}`}>
                What should this day include?
              </label>
              <textarea
                id={`redo-${number}`}
                className="field mt-2"
                value={comment}
                placeholder="Temples, nightclub, a quiet morning…"
                onChange={(event) => setComment(event.target.value)}
              />
              <p className="mt-2 text-xs text-[var(--muted)]">Leave this blank and Safar will write the day.</p>
              <button type="button" className="btn-gold mt-3 w-full rounded-2xl py-3 text-sm font-semibold" onClick={rewrite}>
                Rewrite this day
              </button>
              <button
                type="button"
                className="mt-1 min-h-11 w-full text-sm text-[var(--muted)]"
                onClick={() => {
                  setOpen(false);
                  setError("");
                }}
              >
                Close
              </button>
            </div>
          )}
          {busy && (
            <p className="text-sm text-[#d8d2c6]">
              Rewriting this day
              <span className="typing ml-1">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          )}
          {error && <p className="mt-2 text-sm text-[var(--rose)]">{error}</p>}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(proposal)}
        title="Keep this day?"
        body="The other days stay as they are."
        confirmLabel="Keep this day"
        cancelLabel="Discard"
        onCancel={() => setProposal(null)}
        onConfirm={() => {
          onKeepDay?.(index, number, proposal);
          setProposal(null);
          setOpen(false);
          setComment("");
          setError("");
        }}
      >
        {proposal ? (
          <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-[#d8d2c6]">
            <p className="serif text-xl text-[var(--cream)]">{proposal.title}</p>
            {proposal.morning ? <p><span className="text-[var(--gold)]">Morning. </span>{proposal.morning}</p> : null}
            {proposal.afternoon ? <p><span className="text-[var(--gold)]">Afternoon. </span>{proposal.afternoon}</p> : null}
            {proposal.evening ? <p><span className="text-[var(--gold)]">Evening. </span>{proposal.evening}</p> : null}
            {proposal.food ? <p><span className="text-[var(--gold)]">Food. </span>{proposal.food}</p> : null}
            {proposal.cost ? <p className="text-xs text-[var(--gold)]">{proposal.cost}</p> : null}
          </div>
        ) : null}
      </ConfirmDialog>
    </article>
  );
}

function DayLine({ label, text }) {
  if (!text) return null;
  return (
    <p className="mt-2 text-sm leading-relaxed text-[#d8d2c6]">
      <span className="text-[var(--gold)]">{label}. </span>
      {text}
    </p>
  );
}

function BulletBlock({ title, items }) {
  return (
    <section className="mt-7">
      <h2 className="serif text-2xl font-semibold">{title}</h2>
      <ul className="card mt-3 list-disc space-y-1.5 rounded-[1.3rem] px-7 py-4 text-sm text-[#d8d2c6]">
        {items.map((item, i) => (
          <li key={`${item}-${i}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
