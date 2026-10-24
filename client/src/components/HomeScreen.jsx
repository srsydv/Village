import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { chatPreview } from "../lib/chatHints.js";
import { monthPeek } from "../lib/calendar.js";
import { daysUntil, formatTripSpan } from "../lib/dates.js";
import { CATEGORIES } from "../lib/destinations.js";
import { useIdeaDeck } from "../lib/useIdeaDeck.js";
import { toggleMap } from "../lib/tripChecks.js";
import { deskTrip } from "../lib/tripPhase.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";
import { PlaceIdeas } from "./PlaceIdeas.jsx";
import { PrepDesk, TodayDesk } from "./TodayDesk.jsx";
import { WeekendCard } from "./WeekendCard.jsx";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const { profile, trips, chats, addTrip } = useTravel();
  const navigate = useNavigate();
  const [dest, setDest] = useState("");
  const ideas = useIdeaDeck({ profile, trips });
  const lastChat = chats.find((c) => (c.messages || []).some((m) => m.content));
  const desk = deskTrip(trips);
  const peek = monthPeek(trips);
  const patchTrip = (trip, bucket, id) => {
    addTrip({ ...trip, [bucket]: toggleMap(trip[bucket], id) });
  };

  const goPlan = (label) => {
    const q = String(label || dest || "").trim();
    if (!q) return;
    navigate(`/plan?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="safe-top safe-bottom px-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="kicker">Safar</p>
          <h1 className="serif mt-1 text-[2rem] leading-tight font-semibold">
            {greeting()}{profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {profile.homeCity ? `From ${profile.homeCity} · ` : ""}
            {profile.currency} estimates
            {profile.nationality ? ` · ${profile.nationality} passport` : ""}
          </p>
        </div>
        <Link
          to="/profile"
          className="mt-1 grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-[var(--line)] text-sm font-semibold text-[var(--gold-bright)]"
        >
          {(profile.name || "A").slice(0, 1).toUpperCase()}
        </Link>
      </header>

      {peek ? (
        <Link
          to={`/trips?day=${encodeURIComponent(peek.day)}`}
          className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--gold-bright)]"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" aria-hidden="true" />
          {peek.text}
        </Link>
      ) : null}

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          goPlan(dest);
        }}
      >
        <p className="mb-2 text-[0.7rem] tracking-wide text-[var(--muted)] uppercase">Where are you going?</p>
        <div className="relative z-20">
          <DestinationSuggest
            value={dest}
            placeholder="Lucknow, Goa, Kyoto…"
            onChange={setDest}
            onSelect={(place) => {
              if (place?.label) goPlan(place.label);
            }}
          />
        </div>
        <button type="submit" className="btn-gold mt-3 w-full rounded-2xl py-3 text-sm font-semibold">
          Plan this trip
        </button>
        <button type="button" className="mt-2 w-full py-2 text-xs text-[var(--muted)]" onClick={() => navigate("/ask")}>
          Ask anything
        </button>
      </form>

      {desk?.phase === "prep" && (
        <>
          <PrepDesk trip={desk.trip} profile={profile} onToggle={(id) => patchTrip(desk.trip, "checks", id)} />
          <Link to={`/trips/${desk.trip.id}`} className="mt-2 block text-center text-xs text-[var(--gold)]">
            Open this trip
          </Link>
        </>
      )}
      {desk?.phase === "on-trip" && (
        <>
          <TodayDesk trip={desk.trip} onToggleVisit={(id) => patchTrip(desk.trip, "visited", id)} />
          <Link to={`/trips/${desk.trip.id}`} className="mt-2 block text-center text-xs text-[var(--gold)]">
            Open this trip
          </Link>
        </>
      )}
      {!desk && <WeekendCard profile={profile} />}

      <PlaceIdeas deck={ideas} onOpen={goPlan} />
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {CATEGORIES.slice(0, 6).map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="shrink-0 rounded-full border border-[var(--line)] bg-[rgba(20,28,47,0.7)] px-3.5 py-2 text-xs text-[#d8d2c6]"
            onClick={() => navigate(`/explore?tag=${encodeURIComponent(cat.id)}`)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <Link
        to="/explore"
        className="mt-3 block w-full rounded-2xl border border-[var(--line)] py-2.5 text-center text-xs text-[var(--gold)]"
      >
        Browse all place ideas
      </Link>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h3 className="serif text-2xl font-semibold">Saved journeys</h3>
          <Link to="/trips" className="text-xs text-[var(--gold)]">
            View all
          </Link>
        </div>
        {trips.length === 0 ? (
          <p className="card mt-3 rounded-2xl px-4 py-4 text-sm text-[var(--muted)]">
            No trips yet. Type a city above — Safar writes the days first.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {trips.slice(0, 2).map((trip) => {
              const until = daysUntil(trip.plan?.startDate);
              return (
                <Link key={trip.id} to={`/trips/${trip.id}`} className="card block rounded-2xl px-4 py-3">
                  <p className="text-sm font-medium">{trip.plan?.title || trip.plan?.destination}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {until != null && until >= 0
                      ? until === 0
                        ? "Starts today"
                        : `In ${until} day${until === 1 ? "" : "s"}`
                      : formatTripSpan(trip.plan?.startDate, trip.plan?.daysCount) || trip.plan?.duration}
                    {trip.plan?.budget?.total ? ` · ${trip.plan.budget.total}` : ""}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {lastChat && (
        <section className="mt-7">
          <div className="flex items-end justify-between">
            <h3 className="serif text-2xl font-semibold">Continue</h3>
            {chats.length > 1 && (
              <Link to="/ask?history=1" className="text-xs text-[var(--gold)]">
                All chats
              </Link>
            )}
          </div>
          <Link to={`/ask?chat=${encodeURIComponent(lastChat.id)}`} className="card mt-3 block rounded-2xl px-4 py-3">
            <p className="text-xs text-[var(--gold)]">Last conversation</p>
            <p className="mt-1 line-clamp-2 text-sm text-[#d8d2c6]">{chatPreview(lastChat)}</p>
          </Link>
        </section>
      )}
    </div>
  );
}
