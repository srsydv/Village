import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchIncomingShares } from "../lib/api.js";
import { hasDatedTrip, withDayNote } from "../lib/calendar.js";
import { daysUntil, formatTripSpan } from "../lib/dates.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { PhoneReminders } from "./PhoneReminders.jsx";
import { TripCalendar } from "./TripCalendar.jsx";

export function TripsScreen() {
  const { trips, profile, addTrip } = useTravel();
  const [params, setParams] = useSearchParams();
  const [shared, setShared] = useState([]);
  const dated = hasDatedTrip(trips);
  const focusDay = params.get("day") || "";
  const requested = params.get("view");
  const view = focusDay ? "calendar" : requested === "list" ? "list" : requested === "calendar" || dated ? "calendar" : "list";

  const setView = (next) => {
    const query = new URLSearchParams(params);
    query.set("view", next);
    if (next === "list") query.delete("day");
    setParams(query, { replace: true });
  };

  const setFocusDay = (iso) => {
    const query = new URLSearchParams(params);
    query.set("view", "calendar");
    if (iso) query.set("day", iso);
    else query.delete("day");
    setParams(query, { replace: true });
  };

  useEffect(() => {
    let cancel = false;
    fetchIncomingShares()
      .then((rows) => {
        if (!cancel) setShared(rows);
      })
      .catch(() => {
        if (!cancel) setShared([]);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Library</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">Your trips.</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Saved to your account. They reload on any phone you sign in with.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-[var(--line)] p-1">
        <ViewTab active={view === "calendar"} onClick={() => setView("calendar")}>
          Calendar
        </ViewTab>
        <ViewTab active={view === "list"} onClick={() => setView("list")}>
          List
        </ViewTab>
      </div>

      <PhoneReminders trips={trips} />

      <SharedWithYou shares={shared} />

      {view === "calendar" ? (
        <TripCalendar
          trips={trips}
          profile={profile}
          focusDay={focusDay}
          onFocusDay={setFocusDay}
          onShowList={() => setView("list")}
          onSaveNote={(tripId, iso, text) => {
            const trip = trips.find((item) => item.id === tripId);
            if (!trip) return;
            addTrip(withDayNote(trip, iso, text));
          }}
        />
      ) : (
        <TripList trips={trips} />
      )}
    </div>
  );
}

function SharedWithYou({ shares }) {
  if (!shares.length) return null;
  return (
    <section className="mt-6">
      <p className="kicker">Shared with you</p>
      <div className="mt-3 space-y-3">
        {shares.map((share) => {
          const trip = share.trip;
          const by = share.sharedBy || {};
          const title = trip?.plan?.title || trip?.plan?.destination || "Trip no longer available";
          return (
            <Link key={share.id} to={`/trips/shared/${share.id}`} className="card block rounded-[1.4rem] px-4 py-4">
              <p className="text-xs text-[var(--gold)]">
                Shared by {by.name || "someone"}
                {by.username ? ` · @${by.username}` : ""}
              </p>
              <h2 className="serif mt-1 text-2xl font-semibold leading-tight">{title}</h2>
              {trip?.plan && (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {formatTripSpan(trip.plan.startDate, trip.plan.daysCount) || trip.plan.duration || trip.plan.destination || ""}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ViewTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl py-2.5 text-sm font-medium ${active ? "btn-gold" : "text-[var(--muted)]"}`}
    >
      {children}
    </button>
  );
}

function TripList({ trips }) {
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
    <>
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
    </>
  );
}
