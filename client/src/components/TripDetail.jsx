import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { daysUntil, formatTripSpan } from "../lib/dates.js";
import { pickCount } from "../lib/links.js";
import { uid } from "../lib/storage.js";
import { shareTrip } from "../lib/tripText.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { ItineraryView } from "./ItineraryView.jsx";
import { PlaceCard } from "./PlacePicker.jsx";

export function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trips, addTrip, removeTrip } = useTravel();
  const [shareNote, setShareNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
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
  const until = daysUntil(plan?.startDate);

  const planAgain = () => {
    const qs = new URLSearchParams();
    if (city) qs.set("q", city);
    if (plan?.daysCount) qs.set("days", String(plan.daysCount));
    if (plan?.startDate) qs.set("start", plan.startDate);
    navigate(`/plan?${qs.toString()}`);
  };

  const duplicate = () => {
    const copy = {
      ...trip,
      id: uid(),
      createdAt: Date.now(),
      plan: {
        ...(plan || {}),
        title: plan?.title ? `${plan.title} (copy)` : plan?.destination || "Trip copy",
      },
    };
    addTrip(copy);
    navigate(`/trips/${copy.id}`, { replace: true });
  };

  return (
    <div className="safe-top safe-bottom px-5 pb-8">
      <button type="button" className="text-sm text-[var(--gold)]" onClick={() => navigate(-1)}>
        ← Back
      </button>
      <p className="kicker mt-4">{plan?.country || "Itinerary"}</p>
      <h1 className="serif mt-1 text-[2.15rem] leading-tight font-semibold">{plan?.title || plan?.destination || city}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {span}
        {until != null && until >= 0 ? ` · ${until === 0 ? "starts today" : `in ${until} days`}` : ""}
        {pickCount(picks)
          ? ` · ${pickCount(picks)} pick${pickCount(picks) === 1 ? "" : "s"}`
          : ""}
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
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="flex-1 rounded-2xl border border-[var(--line)] py-2.5 text-sm text-[#d8d2c6]"
          onClick={planAgain}
        >
          Plan again
        </button>
        <button
          type="button"
          className="flex-1 rounded-2xl border border-[var(--line)] py-2.5 text-sm text-[#d8d2c6]"
          onClick={duplicate}
        >
          Duplicate
        </button>
      </div>
      {shareNote && <p className="mt-2 text-xs text-[var(--gold)]">{shareNote}</p>}
      <p className="mt-2 text-xs text-[var(--muted)]">Saved to your account. Share a copy if you want it outside Safar.</p>

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
        onClick={() => setConfirmRemove(true)}
      >
        Remove trip
      </button>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this trip?"
        body="It will be deleted from this phone and your signed-in account."
        confirmLabel="Remove trip"
        danger
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          removeTrip(trip.id);
          navigate("/trips");
        }}
      />
    </div>
  );
}
