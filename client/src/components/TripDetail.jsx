import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchIncomingShare, fetchOutgoingShares, rewriteDay } from "../lib/api.js";
import { tripDates } from "../lib/calendar.js";
import { addDaysIso, daysUntil, formatTripSpan } from "../lib/dates.js";
import { addTripsToPhoneCalendar } from "../lib/phoneReminders.js";
import { pickCount } from "../lib/links.js";
import { uid } from "../lib/storage.js";
import { clearDayVisits, dayNumber, pickVisitId, tidyTripTitle, toggleMap } from "../lib/tripChecks.js";
import { tripDayIndex, tripPhase } from "../lib/tripPhase.js";
import { toggleStay } from "../lib/stays.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { ItineraryView } from "./ItineraryView.jsx";
import { PlaceCard } from "./PlacePicker.jsx";
import { ShareTripSheet } from "./ShareTripSheet.jsx";
import { PrepDesk, TodayDesk, VisitRecap } from "./TodayDesk.jsx";

export function SharedTripDetail() {
  const { shareId } = useParams();
  const [share, setShare] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    setShare(null);
    setError("");
    fetchIncomingShare(shareId)
      .then((next) => {
        if (!cancel) setShare(next);
      })
      .catch((err) => {
        if (!cancel) setError(err.message || "This trip is no longer shared with you.");
      });
    return () => {
      cancel = true;
    };
  }, [shareId]);

  if (error) {
    return (
      <div className="safe-top px-5">
        <p className="mt-10 text-sm text-[var(--muted)]">{error}</p>
        <Link to="/trips" className="mt-3 inline-block text-[var(--gold)]">
          Back to trips
        </Link>
      </div>
    );
  }

  if (!share) {
    return (
      <div className="safe-top px-5">
        <p className="kicker mt-10">Safar</p>
      </div>
    );
  }

  if (share.unavailable || !share.trip) {
    const by = share.sharedBy?.name || "someone";
    return (
      <div className="safe-top px-5">
        <p className="mt-10 text-sm text-[var(--muted)]">
          {by} shared a trip, but it is no longer available.
        </p>
        <Link to="/trips" className="mt-3 inline-block text-[var(--gold)]">
          Back to trips
        </Link>
      </div>
    );
  }

  return <TripDetail incoming={share} />;
}

export function TripDetail({ incoming = null }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { trips, profile, addTrip, removeTrip } = useTravel();
  const readOnly = Boolean(incoming);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedWith, setSharedWith] = useState([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [calendarNote, setCalendarNote] = useState("");
  const trip = incoming?.trip || trips.find((t) => t.id === id);
  const plan = trip?.plan;
  const picks = trip?.picks;

  useEffect(() => {
    if (readOnly) return undefined;
    const title = trip?.plan?.title;
    const tidy = tidyTripTitle(title);
    if (!trip || !title || !tidy || tidy === title) return undefined;
    addTrip({ ...trip, plan: { ...trip.plan, title: tidy } });
    return undefined;
  }, [trip, addTrip, readOnly]);

  useEffect(() => {
    if (readOnly || !trip?.id) return undefined;
    let cancel = false;
    fetchOutgoingShares(trip.id)
      .then((rows) => {
        if (!cancel) setSharedWith(rows);
      })
      .catch(() => {
        if (!cancel) setSharedWith([]);
      });
    return () => {
      cancel = true;
    };
  }, [readOnly, trip?.id, shareOpen]);

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

  const sharedBy = incoming?.sharedBy;
  const sharedNames = sharedWith
    .map((share) => share.user?.name || (share.user?.username ? `@${share.user.username}` : ""))
    .filter(Boolean);

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
      {sharedBy && (
        <p className="mt-2 text-sm text-[var(--gold)]">
          Shared by {sharedBy.name || "someone"}
          {sharedBy.username ? ` · @${sharedBy.username}` : ""}
        </p>
      )}

      {readOnly ? (
        <p className="mt-4 text-xs text-[var(--muted)]">You can look through this plan. Only the owner can change it.</p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn-gold flex-1 rounded-2xl py-2.5 text-sm font-semibold"
              onClick={() => setShareOpen(true)}
            >
              Share
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
          {sharedNames.length > 0 && (
            <p className="mt-2 text-xs text-[var(--muted)]">Shared with {sharedNames.join(", ")}</p>
          )}
          <p className="mt-2 text-xs text-[var(--muted)]">Saved to your account. Share it with someone on Safar, or send the plan outside the app.</p>
        </>
      )}

      {tripDates(trip) ? (
        <div className="mt-3">
          <button
            type="button"
            className="text-sm text-[var(--gold)]"
            onClick={async () => {
              setCalendarNote("");
              try {
                const result = await addTripsToPhoneCalendar([trip]);
                if (result === "cancelled") return;
                setCalendarNote(result === "shared" ? "Choose Calendar from the share sheet." : "Open the calendar file to add these days.");
              } catch (err) {
                setCalendarNote(err.message || "Could not add the calendar.");
              }
            }}
          >
            Add this plan to your phone calendar
          </button>
          {calendarNote ? <p className="mt-1 text-xs text-[var(--muted)]">{calendarNote}</p> : null}
        </div>
      ) : null}

      {!readOnly && phase === "prep" && <PrepDesk trip={trip} profile={profile} onToggle={toggleCheck} />}
      {!readOnly && phase === "on-trip" && <TodayDesk trip={trip} onToggleVisit={toggleVisit} />}
      {!readOnly && phase === "finished" && <VisitRecap trip={trip} onToggleVisit={toggleVisit} />}

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
                onVisited={
                  readOnly
                    ? undefined
                    : () =>
                        toggleVisit(
                          pickVisitId(place.kind === "stay" ? "stay" : place.kind === "food" ? "food" : "sight", place),
                        )
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
        onToggleStay={
          readOnly
            ? () => {}
            : (stayId) =>
                saveTrip({
                  ...trip,
                  travel: { ...(trip.travel || {}), stays: toggleStay(trip.travel?.stays, stayId) },
                })
        }
        onFlightPicks={readOnly ? undefined : (flightPicks) => saveTrip({ ...trip, plan: { ...plan, flightPicks } })}
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
        visited={readOnly ? undefined : trip.visited}
        onToggleVisit={readOnly ? undefined : toggleVisit}
        onRequestDay={!readOnly && plan?.days?.length ? requestDay : undefined}
        onKeepDay={readOnly ? undefined : keepDay}
        todayIndex={todayIndex}
      />

      {!readOnly && (
        <button
          type="button"
          className="mt-8 w-full rounded-2xl border border-[var(--line)] py-3 text-sm text-[var(--rose)]"
          onClick={() => setConfirmRemove(true)}
        >
          Remove trip
        </button>
      )}

      {!readOnly && (
        <ShareTripSheet
          open={shareOpen}
          trip={trip}
          username={profile.username}
          onClose={() => setShareOpen(false)}
        />
      )}

      {!readOnly && (
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
      )}
    </div>
  );
}
