import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  buildCalendar,
  currentMonthKey,
  dayEntries,
  formatDayHeading,
  monthKeyFromIso,
  shiftMonth,
  undatedTripCount,
  weekdayLabels,
} from "../lib/calendar.js";

export function TripCalendar({ trips, profile, focusDay, onFocusDay, onSaveNote, onShowList }) {
  const [month, setMonth] = useState(() => (focusDay ? monthKeyFromIso(focusDay) : currentMonthKey()));
  const [selected, setSelected] = useState(() => focusDay || "");
  const [drafts, setDrafts] = useState({});

  useEffect(() => {
    if (!focusDay) return;
    setSelected(focusDay);
    setMonth(monthKeyFromIso(focusDay));
  }, [focusDay]);

  const model = buildCalendar(trips, month);
  const story = selected ? dayEntries(trips, selected, profile) : null;
  const undated = undatedTripCount(trips);

  const pickDay = (iso) => {
    setSelected(iso);
    onFocusDay?.(iso);
  };

  const moveMonth = (delta) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    if (selected && !selected.startsWith(next)) {
      setSelected("");
      onFocusDay?.("");
    }
  };

  return (
    <div className="mt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="serif text-[1.85rem] leading-none font-semibold">{model.title}</h2>
          {model.summary ? <p className="mt-1.5 text-xs text-[var(--muted)]">{model.summary}</p> : null}
        </div>
        <div className="flex gap-1.5">
          <MonthButton label="Previous month" onClick={() => moveMonth(-1)} />
          <MonthButton label="Next month" onClick={() => moveMonth(1)} flip />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7">
        {weekdayLabels().map((label) => (
          <p key={label} className="pb-2 text-center text-[0.62rem] tracking-wide text-[var(--muted)] uppercase">
            {label}
          </p>
        ))}
        {model.weeks.flat().map((cell, index) =>
          cell.iso ? (
            <DayCell key={cell.iso} cell={cell} selected={cell.iso === selected} onPick={() => pickDay(cell.iso)} />
          ) : (
            <div key={`empty-${index}`} />
          ),
        )}
      </div>

      {undated > 0 && (
        <button type="button" className="mt-3 text-xs text-[var(--gold)]" onClick={onShowList}>
          {undated === 1 ? "1 saved trip has no dates" : `${undated} saved trips have no dates`}
        </button>
      )}

      {story ? (
        <DayPage story={story} drafts={drafts} setDrafts={setDrafts} onSaveNote={onSaveNote} />
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">Tap a day to see the plan and what you marked.</p>
      )}
    </div>
  );
}

function MonthButton({ label, onClick, flip }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[var(--gold-bright)]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={flip ? "rotate-180" : ""}>
        <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function DayCell({ cell, selected, onPick }) {
  const names = cell.bars.map((bar) => bar.label).join(", ");
  const tone = cell.isToday ? (cell.onTrip ? "cal-today cal-today-live" : "cal-today") : selected ? "cal-selected" : "";
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      aria-current={cell.isToday ? "date" : undefined}
      aria-label={`${cell.day}${names ? `, ${names}` : ""}${cell.marked ? ", marked" : ""}`}
      className={`flex min-h-[4.7rem] w-full min-w-0 flex-col rounded-[0.85rem] px-0 pt-1 pb-1 text-left ${tone}`}
    >
      <span className="relative mx-auto grid h-6 w-6 place-items-center text-xs">
        {cell.day}
        {cell.marked ? <span className="cal-mark absolute -top-0.5 -right-1" /> : null}
      </span>
      <span className="mt-auto flex flex-col gap-0.5">
        {Array.from({ length: cell.laneCount }, (_, lane) => {
          const bar = cell.bars.find((item) => item.lane === lane);
          if (!bar) return <span key={lane} className="h-[1.05rem]" />;
          return (
            <span
              key={`${bar.tripId}-${lane}`}
              title={bar.label}
              className={`cal-bar ${bar.alt ? "cal-bar-alt" : ""} ${bar.continuesLeft ? "rounded-l-none" : "ml-0.5 rounded-l-md"} ${
                bar.continuesRight ? "rounded-r-none" : "mr-0.5 rounded-r-md"
              }`}
            >
              {bar.showLabel ? bar.label : ""}
            </span>
          );
        })}
        {cell.extra > 0 ? <span className="px-1 text-[0.55rem] text-[var(--muted)]">+{cell.extra}</span> : null}
      </span>
    </button>
  );
}

function DayPage({ story, drafts, setDrafts, onSaveNote }) {
  return (
    <section className="card rise mt-4 rounded-[1.4rem] p-4">
      <p className="kicker">{story.isToday ? "Today" : formatDayHeading(story.iso)}</p>
      {!story.entries.length ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{story.isFuture ? "Nothing planned." : "A quiet day."}</p>
      ) : (
        <div className="mt-1 space-y-5">
          {story.entries.map((entry) => (
            <DayStory
              key={entry.tripId}
              entry={entry}
              iso={story.iso}
              isPast={story.isPast}
              draft={drafts[`${entry.tripId}:${story.iso}`]}
              onDraft={(value) =>
                setDrafts((current) => ({ ...current, [`${entry.tripId}:${story.iso}`]: value }))
              }
              onSaveNote={onSaveNote}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DayStory({ entry, iso, isPast, draft, onDraft, onSaveNote }) {
  const value = draft ?? entry.note;
  const commit = () => {
    if ((value || "").trim() === (entry.note || "").trim()) return;
    onSaveNote?.(entry.tripId, iso, value);
  };

  return (
    <article>
      <Link to={`/trips/${entry.tripId}`} className="serif mt-1 block text-[1.7rem] leading-tight font-semibold">
        {entry.dayTitle || entry.title}
      </Link>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Day {entry.dayNumber} of {entry.length}
        {entry.destination ? ` · ${entry.destination}` : ""}
      </p>
      {entry.ready.map((line) => (
        <p key={line} className="mt-2 text-xs text-[var(--ok)]">
          {line}
        </p>
      ))}
      {entry.parts.map((part) => (
        <div key={part.id} className="mt-3">
          <p className="text-[0.68rem] tracking-wide text-[var(--muted)] uppercase">{part.label}</p>
          <p className="mt-0.5 text-sm leading-snug text-[#f0e8da]">{part.text}</p>
          {part.status ? <p className="mt-0.5 text-xs text-[var(--ok)]">{part.status}</p> : null}
        </div>
      ))}
      {!entry.parts.length ? <p className="mt-3 text-sm text-[var(--muted)]">This day has no written plan yet.</p> : null}
      {entry.picks.map((pick) => (
        <p key={pick.id} className="mt-2 text-xs text-[var(--ok)]">
          {isPast ? `You marked ${pick.label} done` : `${pick.label} · marked done`}
        </p>
      ))}
      <label className="mt-4 block">
        <span className="text-[0.68rem] tracking-wide text-[var(--muted)] uppercase">Remember this day</span>
        <input
          className="field mt-1.5"
          maxLength={160}
          placeholder="A line to remember"
          value={value}
          onChange={(e) => onDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
    </article>
  );
}
