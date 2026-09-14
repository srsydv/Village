import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatTripSpan } from "../lib/dates.js";
import { pickCount } from "../lib/links.js";
import { shareTrip } from "../lib/tripText.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { ItineraryView } from "./ItineraryView.jsx";
import { PlaceCard } from "./PlacePicker.jsx";

export function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trips, removeTrip } = useTravel();
  const [shareNote, setShareNote] = useState("");
  const trip = trips.find((t) => t.id === id);
  const plan = trip?.plan;
  const picks = trip?.picks;

  if (!trip || (!plan && !picks)) {
    return (
      <div className="safe-top px-5">
        <p className="mt-10 text-sm text-[var(--muted)]">This trip is no longer saved.</p>
        <Link to="/trips" className="mt-3 inline-block text-[var(--gold)]">
          Back to trips
        </Link>
      </div>
    );
  }

  const city = plan?.destination || picks?.stay?.city || "";
  const selected = [picks?.stay, ...(picks?.food || []), ...(picks?.sights || [])].filter(Boolean);
  const span = formatTripSpan(plan?.startDate, plan?.daysCount) || plan?.duration;

  return (
    <div className="safe-top safe-bottom px-5 pb-8">
      <button type="button" className="text-sm text-[var(--gold)]" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <p className="kicker mt-4">{plan?.country || "Itinerary"}</p>
      <h1 className="serif mt-1 text-[2.15rem] leading-tight font-semibold">{plan?.title || plan?.destination || city}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {span}
        {pickCount(picks) ? ` · ${pickCount(picks)} picks` : ""}
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-gold flex-1 rounded-2xl py-2.5 text-sm font-semibold"
          onClick={async () => {
            try {
              const result = await shareTrip(trip);
              setShareNote(result === "copied" ? "Copied to clipboard" : "Shared");
            } catch (err) {
              setShareNote(err.message || "Could not share.");
            }
          }}
        >
          Share plan
        </button>
        <Link
          to={`/choose?q=${encodeURIComponent(city)}&trip=${trip.id}`}
          className="flex-1 rounded-2xl border border-[var(--line)] py-2.5 text-center text-sm text-[#d8d2c6]"
        >
          Change picks
        </Link>
      </div>
      {shareNote && <p className="mt-2 text-xs text-[var(--gold)]">{shareNote}</p>}
      <p className="mt-2 text-xs text-[var(--muted)]">
        Trips are saved only on this phone. Share or copy if you want a backup.
      </p>

      {selected.length > 0 && (
        <section className="mt-6">
          <h2 className="serif text-2xl font-semibold">Your picks</h2>
          <div className="mt-3 space-y-2">
            {selected.map((place) => (
              <PlaceCard key={place.id} place={place} city={city} selected compact />
            ))}
          </div>
        </section>
      )}

      <ItineraryView plan={plan} weather={trip.weather} showDates={false} />

      <button
        type="button"
        className="mt-8 w-full rounded-2xl border border-[var(--line)] py-3 text-sm text-[var(--rose)]"
        onClick={() => {
          removeTrip(trip.id);
          navigate("/trips");
        }}
      >
        Remove trip
      </button>
    </div>
  );
}
