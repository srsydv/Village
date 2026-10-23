import { Link } from "react-router-dom";
import { checkedCount, dayVisitItems, pickVisitItems, prepTasks } from "../lib/tripChecks.js";
import { tripDayIndex } from "../lib/tripPhase.js";
import { CheckRow } from "./CheckRow.jsx";

export function PrepDesk({ trip, profile, onToggle }) {
  const tasks = prepTasks(trip, profile);
  if (!tasks.length) return null;
  const tickable = tasks.filter((task) => !task.link);
  const done = checkedCount(
    tickable.map((task) => task.id),
    trip.checks,
  );
  const city = trip.plan?.destination || "";

  return (
    <section className="card mt-4 rounded-[1.4rem] p-4">
      <p className="kicker">Before you go</p>
      <h2 className="serif mt-1 text-[1.7rem] leading-tight font-semibold">
        {trip.plan?.title || trip.plan?.destination}
      </h2>
      {tickable.length > 0 ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {done} of {tickable.length} ready
        </p>
      ) : null}
      <div className="mt-2">
        {tasks.map((task) =>
          task.link ? (
            <Link
              key={task.id}
              to={`/choose?q=${encodeURIComponent(city)}&trip=${trip.id}`}
              className="flex min-h-11 items-center text-sm text-[var(--gold-bright)]"
            >
              Pick a stay
            </Link>
          ) : (
            <CheckRow
              key={task.id}
              checked={Boolean(trip.checks?.[task.id])}
              label={task.label}
              detail={task.detail}
              onToggle={() => onToggle(task.id)}
            />
          ),
        )}
      </div>
    </section>
  );
}

export function TodayDesk({ trip, onToggleVisit }) {
  const index = tripDayIndex(trip);
  const day = index == null ? null : trip.plan?.days?.[index];
  const parts = day ? dayVisitItems(day, index) : [];
  const picks = pickVisitItems(trip.picks);
  const stay = trip.picks?.stay;

  return (
    <section className="card mt-4 rounded-[1.4rem] p-4">
      <p className="kicker">Today</p>
      <h2 className="serif mt-1 text-[1.7rem] leading-tight font-semibold">
        {day?.title || trip.plan?.title || trip.plan?.destination}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {day ? `Day ${day.day || index + 1}` : "This day"}
        {trip.plan?.destination ? ` · ${trip.plan.destination}` : ""}
        {stay?.name ? ` · ${stay.name}` : ""}
      </p>
      {day?.cost ? <p className="mt-2 text-xs text-[var(--gold)]">{day.cost}</p> : null}
      <div className="mt-2">
        {parts.map((item) => (
          <CheckRow
            key={item.id}
            checked={Boolean(trip.visited?.[item.id])}
            label={item.text}
            detail={item.label}
            onToggle={() => onToggleVisit(item.id)}
          />
        ))}
        {!parts.length && (
          <p className="py-2 text-sm text-[var(--muted)]">This day has no written plan yet. Redo it below.</p>
        )}
        {picks.map((item) => (
          <CheckRow
            key={item.id}
            checked={Boolean(trip.visited?.[item.id])}
            label={item.label}
            detail={item.detail}
            onToggle={() => onToggleVisit(item.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function VisitRecap({ trip, onToggleVisit }) {
  const items = [];
  const days = trip.plan?.days || [];
  days.forEach((day, index) => {
    dayVisitItems(day, index).forEach((item) => {
      items.push({ ...item, detail: `Day ${item.day} · ${item.label}`, label: item.text });
    });
  });
  pickVisitItems(trip.picks).forEach((item) => items.push(item));
  if (!items.length) return null;
  const done = items.filter((item) => trip.visited?.[item.id]);
  const skipped = items.filter((item) => !trip.visited?.[item.id]);

  return (
    <section className="card mt-4 rounded-[1.4rem] p-4">
      <p className="kicker">This trip</p>
      <h2 className="serif mt-1 text-[2rem] leading-none font-semibold">
        {done.length} of {items.length}
      </h2>
      <p className="mt-2 text-sm text-[var(--muted)]">What you visited, and what you skipped. Tick anything you forgot.</p>
      {done.length > 0 && (
        <div className="mt-3">
          <p className="text-[0.7rem] tracking-wide text-[var(--muted)] uppercase">Visited</p>
          {done.map((item) => (
            <CheckRow
              key={item.id}
              checked
              label={item.label}
              detail={item.detail}
              onToggle={() => onToggleVisit(item.id)}
            />
          ))}
        </div>
      )}
      {skipped.length > 0 && (
        <div className="mt-3">
          <p className="text-[0.7rem] tracking-wide text-[var(--muted)] uppercase">Skipped</p>
          {skipped.map((item) => (
            <CheckRow
              key={item.id}
              checked={false}
              label={item.label}
              detail={item.detail}
              onToggle={() => onToggleVisit(item.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
