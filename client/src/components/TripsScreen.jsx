import { Link } from "react-router-dom";
import { formatTripSpan } from "../lib/dates.js";
import { useTravel } from "../lib/TravelContext.jsx";

export function TripsScreen() {
  const { trips } = useTravel();

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Library</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">Your trips.</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Saved on this phone only. Open a trip to share a copy.
      </p>

      {trips.length === 0 ? (
        <div className="card mt-8 rounded-[1.5rem] px-5 py-8 text-center">
          <p className="serif text-2xl">Nothing packed yet.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Type a city on Home or Plan. You get the itinerary first.</p>
          <Link to="/plan" className="btn-gold mt-5 inline-flex rounded-2xl px-5 py-3 text-sm font-semibold">
            Plan a trip
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {trips.map((trip) => (
            <Link key={trip.id} to={`/trips/${trip.id}`} className="card block rounded-[1.4rem] px-4 py-4">
              <p className="kicker">{trip.plan?.country || "Journey"}</p>
              <h2 className="serif mt-1 text-2xl font-semibold leading-tight">
                {trip.plan?.title || trip.plan?.destination}
              </h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {formatTripSpan(trip.plan?.startDate, trip.plan?.daysCount) || trip.plan?.duration || ""}
                  {trip.plan?.budget?.total ? ` · ${trip.plan.budget.total}` : ""}
                  {trip.picks?.stay ? ` · ${trip.picks.stay.name}` : ""}
                </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
