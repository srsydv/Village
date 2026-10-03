import { useState } from "react";
import { STAY_STANDARDS, staySearchUrl, toggleStay } from "../lib/stays.js";

export function StayChoices({ selected, onToggle, destination, startDate, endDate, adults, showSearch = false }) {
  const [local, setLocal] = useState([]);
  const controlled = Array.isArray(selected) && typeof onToggle === "function";
  const ids = controlled ? selected : local;
  const toggle = controlled ? onToggle : (id) => setLocal((current) => toggleStay(current, id));
  const chosen = STAY_STANDARDS.filter((item) => ids.includes(item.id));
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-1.5 block text-[0.7rem] tracking-wide text-[var(--muted)] uppercase">Where will you stay?</legend>
      <p className="mb-2 text-xs leading-relaxed text-[var(--muted)]">
        Choose one or more. Each opens a live search for that standard. Safar does not name a hotel for you.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {STAY_STANDARDS.map((item) => {
          const on = ids.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item.id)}
              className={`rounded-2xl border px-2.5 py-3 text-left ${
                on ? "border-[var(--gold)] bg-[rgba(201,163,106,0.14)]" : "border-[var(--line)] bg-transparent"
              }`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-medium">{item.label}</span>
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.6rem] ${
                    on ? "bg-[var(--gold)] text-[#1a140c]" : "border border-[var(--line)] text-transparent"
                  }`}
                >
                  ✓
                </span>
              </span>
              <span className="mt-1 block text-[0.65rem] leading-snug text-[var(--muted)]">{item.hint}</span>
            </button>
          );
        })}
      </div>
      {showSearch && chosen.length > 0 && (
        <div className="mt-3 space-y-2">
          {chosen.map((item) => {
            const href = staySearchUrl({ id: item.id, destination, startDate, endDate, adults });
            if (!href) return null;
            return (
              <a
                key={item.id}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block text-[0.65rem] text-[var(--muted)]">{item.search} in {destination}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-[var(--gold-bright)]">See stays</span>
              </a>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
