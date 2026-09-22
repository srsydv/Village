import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { daysUntil, formatTripSpan } from "../lib/dates.js";
import { useTravel } from "../lib/TravelContext.jsx";

export function TripsScreen() {
  const { trips } = useTravel();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = trips.filter((trip) => {
      if (!query) return true;
      const hay = `${trip.plan?.title || ""} ${trip.plan?.destination || ""} ${trip.plan?.country || ""}`.toLowerCase();
      return hay.includes(query);
    });
    return [...filtered].sort((a, b) => {
      const da = daysUntil(a.plan?.startDate);
      const db = daysUntil(b.plan?.startDate);
      const aUpcoming = da != null && da >= 0;
      const bUpcoming = db != null && db >= 0;
      if (aUpcoming && bUpcoming) return da - db;
      if (aUpcoming) return -1;
      if (bUpcoming) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [q, trips]);

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Library</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">Your trips.</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Saved to your account. They reload on any phone you sign in with.
      </p>

      {trips.length >= 4 && (
        <input
          className="field mt-5"
          placeholder="Search a city or title…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}

      {trips.length === 0 ? (
        <div className="card mt-8 rounded-[1.5rem] px-5 py-8 text-center">
          <p className="serif text-2xl">Nothing packed yet.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Type a city on Home or Plan. You get the itinerary first.</p>
          <Link to="/plan" className="btn-gold mt-5 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold">
            Plan a trip
          </Link>
        </div>
      ) : list.length === 0 ? (
        <p className="card mt-6 rounded-2xl px-4 py-4 text-sm text-[var(--muted)]">No trips match that search.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {list.map((trip) => {
            const until = daysUntil(trip.plan?.startDate);
            return (
              <Link key={trip.id} to={`/trips/${trip.id}`} className="card block rounded-[1.4rem] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="kicker">{trip.plan?.country || "Journey"}</p>
                  {until != null && until >= 0 && (
                    <span className="text-[0.65rem] tracking-wide text-[var(--gold)] uppercase">
                      {until === 0 ? "Today" : until === 1 ? "Tomorrow" : `In ${until} days`}
                    </span>
                  )}
                </div>
                <h2 className="serif mt-1 text-2xl font-semibold leading-tight">
                  {trip.plan?.title || trip.plan?.destination}
                </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {formatTripSpan(trip.plan?.startDate, trip.plan?.daysCount) || trip.plan?.duration || ""}
                  {trip.plan?.budget?.total ? ` · ${trip.plan.budget.total}` : ""}
                  {trip.picks?.stay ? ` · ${trip.picks.stay.name}` : ""}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
