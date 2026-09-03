import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DESTINATIONS, QUICK_ASKS } from "../lib/destinations.js";
import { useTravel } from "../lib/TravelContext.jsx";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function HomeScreen() {
  const { profile, trips, chats } = useTravel();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const featured = DESTINATIONS[new Date().getDate() % DESTINATIONS.length];

  return (
    <div className="safe-top safe-bottom px-5">
      <header className="flex items-start justify-between">
        <div>
          <p className="kicker">Aurea</p>
          <h1 className="serif mt-1 text-[2rem] leading-tight font-semibold">
            {greeting()}
            {profile.name ? `, ${profile.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {profile.homeCity ? `From ${profile.homeCity} · ` : ""}
            {profile.currency} estimates
          </p>
        </div>
        <Link
          to="/privacy"
          className="mt-1 grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-sm font-semibold text-[var(--gold-bright)]"
        >
          {(profile.name || "A").slice(0, 1).toUpperCase()}
        </Link>
      </header>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          if (!q) return;
          navigate(`/ask?q=${encodeURIComponent(q)}`);
        }}
      >
        <div className="glass flex items-center gap-2 rounded-[1.35rem] px-3 py-2">
          <span className="pl-1 text-[var(--gold)]">✦</span>
          <input
            className="h-11 w-full bg-transparent text-[0.95rem] outline-none placeholder:text-[#6d7588]"
            placeholder="Ask for a destination, budget, hotel…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="btn-gold rounded-xl px-3 py-2 text-xs font-semibold">
            Ask
          </button>
        </div>
      </form>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        {QUICK_ASKS.map((ask) => (
          <button
            key={ask.id}
            type="button"
            className="shrink-0 rounded-full border border-[var(--line)] bg-[rgba(20,28,47,0.7)] px-3.5 py-2 text-xs text-[#d8d2c6]"
            onClick={() => navigate(`/ask?q=${encodeURIComponent(ask.prompt)}`)}
          >
            {ask.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="card relative mt-6 w-full overflow-hidden rounded-[1.7rem] text-left"
        onClick={() =>
          navigate(
            `/ask?q=${encodeURIComponent(
              `I want to visit ${featured.name}, ${featured.country}. Give me the best time to go, a realistic ${profile.currency} budget, 3 hotel picks, and a 5-day plan.`,
            )}`,
          )
        }
      >
        <img src={featured.image} alt="" className="h-56 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-[#070B14]/25 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="kicker">Today’s escape</p>
          <h2 className="serif mt-1 text-3xl font-semibold">{featured.name}</h2>
          <p className="mt-1 text-sm text-[#d8d2c6]">
            {featured.country} · {featured.vibe} · from {featured.from}
          </p>
        </div>
      </button>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h3 className="serif text-2xl font-semibold">Saved journeys</h3>
          <Link to="/trips" className="text-xs text-[var(--gold)]">
            View all
          </Link>
        </div>
        {trips.length === 0 ? (
          <Link to="/plan" className="card mt-3 block rounded-2xl px-4 py-4 text-sm text-[var(--muted)]">
            No trips yet. Design one in a minute — destination, budget, hotels, and days.
          </Link>
        ) : (
          <div className="mt-3 space-y-2">
            {trips.slice(0, 2).map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`} className="card block rounded-2xl px-4 py-3">
                <p className="text-sm font-medium">{trip.plan?.title || trip.plan?.destination}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {trip.plan?.duration} · {trip.plan?.budget?.total}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {chats[0] && (
        <section className="mt-7">
          <h3 className="serif text-2xl font-semibold">Continue</h3>
          <Link to="/ask" className="card mt-3 block rounded-2xl px-4 py-3">
            <p className="text-xs text-[var(--gold)]">Last conversation</p>
            <p className="mt-1 line-clamp-2 text-sm text-[#d8d2c6]">
              {[...(chats[0].messages || [])].reverse().find((m) => m.role === "user")?.content}
            </p>
          </Link>
        </section>
      )}
    </div>
  );
}
