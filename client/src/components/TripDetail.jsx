import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { rewriteDay } from "../lib/api.js";
import { addDaysIso, daysUntil, formatTripSpan } from "../lib/dates.js";
import { pickCount } from "../lib/links.js";
import { uid } from "../lib/storage.js";
import { clearDayVisits, dayNumber, pickVisitId, tidyTripTitle, toggleMap } from "../lib/tripChecks.js";
import { tripDayIndex, tripPhase } from "../lib/tripPhase.js";
import { toggleStay } from "../lib/stays.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { ItineraryView } from "./ItineraryView.jsx";
import { PlaceCard } from "./PlacePicker.jsx";
import { PrepDesk, TodayDesk, VisitRecap } from "./TodayDesk.jsx";

export function TripDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trips, profile, addTrip, removeTrip } = useTravel();
  const [shareNote, setShareNote] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const trip = trips.find((t) => t.id === id);
  const plan = trip?.plan;
  const picks = trip?.picks;

  useEffect(() => {
    const title = trip?.plan?.title;
    const tidy = tidyTripTitle(title);
    if (!trip || !title || !tidy || tidy === title) return;
    addTrip({ ...trip, plan: { ...trip.plan, title: tidy } });
  }, [trip, addTrip]);

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
  const phase = tripPhase(trip);
  const todayIndex = tripDayIndex(trip);

  const saveTrip = (next) => addTrip(next);
  const toggleCheck = (id) => saveTrip({ ...trip, checks: toggleMap(trip.checks, id) });
  const toggleVisit = (id) => saveTrip({ ...trip, visited: toggleMap(trip.visited, id) });

  const requestDay = (day, index, comment) => {
    const number = dayNumber(day, index);
    const otherDays = (plan?.days || [])
      .map((item, i) => ({ item, i }))
      .filter(({ i }) => i !== index)
      .map(({ item, i }) => ({
        day: dayNumber(item, i),
        title: item.title,
        morning: item.morning,
        afternoon: item.afternoon,
        evening: item.evening,
      }));
    return rewriteDay({
      destination: plan?.destination || city,
      country: plan?.country,
      dayNumber: number,
      dayDate: plan?.startDate ? addDaysIso(plan.startDate, number - 1) : "",
      comment,
      otherDays,
      profile,
    });
  };

  const keepDay = (index, dayNum, nextDay) => {
    const days = (plan?.days || []).map((day, i) => (i === index ? { ...nextDay, day: dayNum } : day));
    saveTrip({
      ...trip,
      plan: { ...plan, days },
      visited: clearDayVisits(trip.visited, dayNum),
    });
  };

  const planAgain = () => {
    const qs = new URLSearchParams();
    if (city) qs.set("q", city);
    if (plan?.daysCount) qs.set("days", String(plan.daysCount));
    if (plan?.startDate) qs.set("start", plan.startDate);
    if (trip.travel?.origin) qs.set("origin", trip.travel.origin);
    if (trip.travel?.modes?.length) qs.set("modes", trip.travel.modes.join(","));
    if (trip.travel?.stays?.length) qs.set("stays", trip.travel.stays.join(","));
    navigate(`/plan?${qs.toString()}`);
  };

  const duplicate = () => {
    const copy = {
      ...trip,
      id: uid(),
      createdAt: Date.now(),
      plan: {
        ...(plan || {}),
        title: tidyTripTitle(plan?.title) || plan?.destination || "Trip",
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
          Copy trip
        </button>
      </div>
      {shareNote && <p className="mt-2 text-xs text-[var(--gold)]">{shareNote}</p>}
      <p className="mt-2 text-xs text-[var(--muted)]">Saved to your account. Share a copy if you want it outside Safar.</p>

      {phase === "prep" && <PrepDesk trip={trip} profile={profile} onToggle={toggleCheck} />}
      {phase === "on-trip" && <TodayDesk trip={trip} onToggleVisit={toggleVisit} />}
      {phase === "finished" && <VisitRecap trip={trip} onToggleVisit={toggleVisit} />}

      {selected.length > 0 && (
        <section className="mt-6">
          <h2 className="serif text-2xl font-semibold">Your picks</h2>
          <div className="mt-3 space-y-2">
            {selected.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                city={city}
                selected
                compact
                visited={Boolean(trip.visited?.[pickVisitId(place.kind === "stay" ? "stay" : place.kind === "food" ? "food" : "sight", place)])}
                onVisited={() =>
                  toggleVisit(pickVisitId(place.kind === "stay" ? "stay" : place.kind === "food" ? "food" : "sight", place))
                }
              />
            ))}
          </div>
        </section>
      )}

      <ItineraryView
        plan={plan}
        weather={trip.weather}
        stays={trip.travel?.stays || []}
        onToggleStay={(id) =>
          saveTrip({
            ...trip,
            travel: { ...(trip.travel || {}), stays: toggleStay(trip.travel?.stays, id) },
          })
        }
        onFlightPicks={(flightPicks) => saveTrip({ ...trip, plan: { ...plan, flightPicks } })}
        journey={
          trip.travel?.modes?.length
            ? {
                from: trip.travel.origin || profile.homeCity,
                to: plan?.destination || city,
                date: plan?.startDate,
                adults: trip.travel.adults || 1,
                kids: trip.travel.kids || 0,
                modes: trip.travel.modes,
                originCountry: trip.travel.originCountry || "",
                destCountry: plan?.country || "",
                rides: plan?.rides,
                flightPicks: plan?.flightPicks,
                currency: profile.currency || plan?.currency,
                profile,
              }
            : null
        }
        showDates={false}
        visited={trip.visited}
        onToggleVisit={toggleVisit}
        onRequestDay={plan?.days?.length ? requestDay : undefined}
        onKeepDay={keepDay}
        todayIndex={todayIndex}
      />

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
