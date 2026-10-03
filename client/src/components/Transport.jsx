import { useState } from "react";
import { TRANSPORT_MODES } from "../lib/transport.js";

export function TransportPicker({ modes, onToggle }) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-1.5 block text-[0.7rem] tracking-wide text-[var(--muted)] uppercase">How will you go?</legend>
      <p className="mb-2 text-xs leading-relaxed text-[var(--muted)]">
        Choose one or more. Safar ranks the usual fare, then opens the booking site for your country with the search filled in.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {TRANSPORT_MODES.map((mode) => {
          const on = modes.includes(mode.id);
          return (
            <button
              key={mode.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(mode.id)}
              className={`rounded-2xl border px-2.5 py-3 text-left ${
                on ? "border-[var(--gold)] bg-[rgba(201,163,106,0.14)]" : "border-[var(--line)] bg-transparent"
              }`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-medium">{mode.label}</span>
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.6rem] ${
                    on ? "bg-[var(--gold)] text-[#1a140c]" : "border border-[var(--line)] text-transparent"
                  }`}
                >
                  ✓
                </span>
              </span>
              <span className="mt-1 block text-[0.65rem] text-[var(--muted)]">{mode.line}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TransportBoard({ board }) {
  if (!board?.options?.length) return null;
  return (
    <section className="mt-6">
      <p className="kicker">Getting there</p>
      <h2 className="serif mt-1 text-[1.85rem] leading-tight font-semibold">
        {board.from} to {board.to}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {[board.when, board.party, "one way"].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-[#d8d2c6]">{board.headline}</p>
      <div className="mt-4 space-y-3">
        {board.options.map((option) => (
          <FareCard key={option.id} option={option} />
        ))}
      </div>
      <p className="mt-3 text-[0.65rem] leading-relaxed text-[var(--muted)]">{board.footnote}</p>
    </section>
  );
}

function FareCard({ option }) {
  const [open, setOpen] = useState(false);
  const primary = option.partners.find((item) => item.primary) || option.partners[0];
  const rest = option.partners.filter((item) => item !== primary);
  const compare = option.id === "flight";
  if (option.impractical) {
    return (
      <article className="rounded-2xl border border-[var(--line)] px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-sm font-medium">{option.label}</span>
          <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)]">
            <span className="whitespace-nowrap">{option.price}</span>
            <span aria-hidden="true">{open ? "−" : "+"}</span>
          </span>
        </button>
        {open ? (
          <div className="pb-1">
            {option.why ? <p className="text-sm leading-relaxed text-[#d8d2c6]">{option.why}</p> : null}
            {option.hint ? <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{option.hint}</p> : null}
            {primary ? (
              <a
                href={primary.href}
                target="_blank"
                rel="noreferrer"
                className="btn-gold mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl px-3 py-3 text-center text-sm font-semibold"
              >
                {primary.action}
              </a>
            ) : null}
            {rest.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {rest.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.65rem] text-[var(--gold-bright)]"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </article>
    );
  }
  return (
    <article
      className={`card rounded-[1.45rem] p-4 ${
        option.recommended ? "ring-1 ring-[var(--gold)] shadow-[0_18px_40px_-24px_rgba(201,163,106,0.9)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {option.recommended ? <p className="kicker">Recommended</p> : null}
          <h3 className={`serif font-semibold leading-none ${option.recommended ? "mt-1 text-[1.85rem]" : "text-[1.45rem]"}`}>
            {option.label}
          </h3>
          {(option.service || option.duration) && (
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              {[option.service, option.duration].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {compare && option.picks?.length ? (
            <p className="text-[0.6rem] uppercase tracking-[0.14em] text-[var(--muted)]">Best fare</p>
          ) : null}
          {option.price ? (
            <p className="serif text-[1.05rem] leading-tight whitespace-nowrap text-[var(--gold-bright)]">{option.price}</p>
          ) : null}
        </div>
      </div>
      {option.why ? <p className="mt-3 text-sm leading-relaxed text-[#d8d2c6]">{option.why}</p> : null}
      {option.routeNote ? <p className="mt-2 text-sm leading-relaxed text-[#d8d2c6]">{option.routeNote}</p> : null}
      {compare && option.picks?.length ? null : <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{option.hint}</p>}
      {compare && option.picking ? <p className="mt-3 text-sm text-[#d8d2c6]">Choosing up to three flights…</p> : null}
      {compare && !option.picking && !option.picks?.length ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No flight stood out for this date.</p>
      ) : null}
      {compare && option.picks?.length > 0 ? (
        <div className="mt-4 space-y-2">
          {option.picks.map((pick) => (
            <a
              key={`${pick.airline}-${pick.via}-${pick.fareLow}`}
              href={pick.href}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl border border-[var(--line)] px-3 py-3"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  {pick.best ? <span className="kicker">Best fare</span> : null}
                  <span className={`block text-sm font-medium ${pick.best ? "mt-1" : ""}`}>{pick.airline}</span>
                  <span className="mt-0.5 block text-[0.65rem] leading-snug text-[var(--muted)]">
                    {[pick.stopsLabel, pick.via ? `via ${pick.via}` : "", pick.duration].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="serif block text-sm whitespace-nowrap text-[var(--gold-bright)]">{pick.typicalFare}</span>
                  <span className="mt-1 block text-xs font-medium text-[var(--gold-bright)]">See flight</span>
                </span>
              </span>
              {pick.why ? <span className="mt-2 block text-sm leading-relaxed text-[#d8d2c6]">{pick.why}</span> : null}
            </a>
          ))}
          <p className="text-xs leading-relaxed text-[var(--muted)]">Typical totals for this date. Open a flight to see today’s fare and bags.</p>
        </div>
      ) : compare ? null : (
        <>
          {primary ? (
            <a
              href={primary.href}
              target="_blank"
              rel="noreferrer"
              className="btn-gold mt-4 flex min-h-11 w-full items-center justify-center rounded-2xl px-3 py-3 text-center text-sm font-semibold"
            >
              {primary.action}
            </a>
          ) : null}
          {rest.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {rest.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.65rem] text-[var(--gold-bright)]"
                >
                  {item.name}
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}
