import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { chatPreview } from "../lib/chatHints.js";
import { daysUntil, formatTripSpan } from "../lib/dates.js";
import { CATEGORIES, DESTINATIONS } from "../lib/destinations.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const { profile, trips, chats } = useTravel();
  const navigate = useNavigate();
  const [dest, setDest] = useState("");
  const featured = DESTINATIONS[new Date().getDate() % DESTINATIONS.length];
  const moreIdeas = DESTINATIONS.filter((d) => d.id !== featured.id).slice(0, 5);
  const lastChat = chats.find((c) => (c.messages || []).some((m) => m.content));
  const nextTrip = trips
    .map((trip) => ({ trip, days: daysUntil(trip.plan?.startDate) }))
    .filter((row) => row.days != null && row.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

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
          I just have a question
        </button>
      </form>

      {nextTrip && (
        <Link to={`/trips/${nextTrip.trip.id}`} className="card mt-4 block rounded-[1.3rem] px-4 py-3">
          <p className="kicker">Coming up</p>
          <p className="mt-1 text-sm font-medium">
            {nextTrip.trip.plan?.title || nextTrip.trip.plan?.destination}
            <span className="text-[var(--muted)]">
              {" · "}
              {nextTrip.days === 0
                ? "starts today"
                : nextTrip.days === 1
                  ? "tomorrow"
                  : `in ${nextTrip.days} days`}
            </span>
          </p>
        </Link>
      )}

      <button
        type="button"
        className="card relative mt-5 w-full overflow-hidden rounded-[1.7rem] text-left"
        onClick={() => goPlan(`${featured.name}, ${featured.country}`)}
      >
        <img src={featured.image} alt="" className="h-48 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="kicker">Idea if you are stuck</p>
          <h2 className="serif mt-1 text-3xl font-semibold">{featured.name}</h2>
          <p className="mt-1 text-sm text-[#d8d2c6]">
            {featured.country} · {featured.vibe}
            {profile.currency === "INR" ? ` · from ${featured.from}` : ` · ${featured.season}`}
          </p>
        </div>
      </button>

      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
        {moreIdeas.map((place) => (
          <button
            key={place.id}
            type="button"
            className="card relative h-36 w-36 shrink-0 overflow-hidden rounded-[1.2rem] text-left"
            onClick={() => goPlan(`${place.name}, ${place.country}`)}
          >
            <img src={place.image} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2.5">
              <p className="serif text-lg font-semibold leading-none">{place.name}</p>
              <p className="mt-1 text-[0.65rem] text-[#d0c9bc]">{place.country}</p>
            </div>
          </button>
        ))}
      </div>
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
