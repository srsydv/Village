import { isPicked, placeLinks } from "../lib/links.js";

const TABS = [
  { id: "stays", kind: "stay", label: "Stays" },
  { id: "food", kind: "food", label: "Food" },
  { id: "sights", kind: "sights", label: "Sights" },
];

export function PlacePicker({ catalog, picks, onToggle, tab, onTab }) {
  const lists = {
    stays: catalog?.stays || [],
    food: catalog?.food || [],
    sights: catalog?.sights || [],
  };
  const city = catalog?.place?.city || catalog?.place?.name || "";
  const items = lists[tab] || [];

  return (
    <div>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`flex-1 rounded-2xl py-2 text-xs font-medium ${
              tab === t.id ? "bg-[var(--gold)] text-[#1a140c]" : "border border-[var(--line)] text-[#d8d2c6]"
            }`}
          >
            {t.label}
            <span className="opacity-70"> {lists[t.id].length}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {tab === "stays" && "Tap one stay. Then Book opens Booking.com or Airbnb."}
        {tab === "food" && "Pick up to 5 places. Maps / Zomato open the listing."}
        {tab === "sights" && "Pick up to 6 sights to pin on your trip."}
      </p>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="card rounded-2xl px-4 py-5 text-sm text-[var(--muted)]">
            No mapped {tab} here yet. Try a bigger city name.
          </p>
        ) : (
          items.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              city={city}
              selected={isPicked(picks, place)}
              onToggle={() => onToggle(place)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function PlaceCard({ place, city, selected, onToggle, compact }) {
  const links = placeLinks(place, city);
  return (
    <article className={`card rounded-[1.25rem] p-3.5 ${selected ? "ring-1 ring-[var(--gold)]" : ""}`}>
      <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => onToggle?.()}>
        <span
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[0.65rem] ${
            selected ? "border-[var(--gold)] bg-[var(--gold)] text-[#1a140c]" : "border-[var(--line)] text-transparent"
          }`}
        >
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium leading-snug">{place.name}</p>
            {place.stars ? <span className="shrink-0 text-xs text-[var(--gold-bright)]">{place.stars}★</span> : null}
          </div>
          <p className="mt-0.5 text-[0.7rem] capitalize text-[var(--muted)]">
            {place.type}
            {place.cuisine ? ` · ${place.cuisine}` : ""}
            {place.distanceKm != null ? ` · ${place.distanceKm} km` : ""}
          </p>
          {!compact && place.area && <p className="mt-1 text-xs text-[#d0c9bc]">{place.area}</p>}
        </div>
      </button>
      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-8">
        <OutLink href={links.maps}>Maps</OutLink>
        {place.kind === "stay" && <OutLink href={links.booking}>Book stay</OutLink>}
        {place.kind === "stay" && <OutLink href={links.airbnb}>Airbnb</OutLink>}
        {place.kind === "food" && <OutLink href={links.zomato}>Zomato</OutLink>}
        {place.website ? <OutLink href={place.website.startsWith("http") ? place.website : `https://${place.website}`}>Site</OutLink> : null}
      </div>
    </article>
  );
}

function OutLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.65rem] text-[var(--gold-bright)]"
    >
      {children}
    </a>
  );
}

export function WeatherStrip({ weather }) {
  if (!weather) return null;
  return (
    <div className="card no-scrollbar mb-4 flex gap-3 overflow-x-auto rounded-[1.3rem] px-4 py-3">
      <div className="shrink-0 pr-2">
        <p className="kicker">Weather</p>
        <p className="mt-1 text-sm">
          {weather.nowC != null ? `${Math.round(weather.nowC)}°` : "—"}{" "}
          <span className="text-[var(--muted)]">{weather.nowLabel}</span>
        </p>
      </div>
      {(weather.daily || []).slice(0, 5).map((d) => (
        <div key={d.date} className="shrink-0 border-l border-[var(--line)] pl-3">
          <p className="text-[0.65rem] text-[var(--muted)]">
            {new Date(d.date).toLocaleDateString(undefined, { weekday: "short" })}
          </p>
          <p className="text-xs">
            {Math.round(d.high)}° / {Math.round(d.low)}°
          </p>
        </div>
      ))}
    </div>
  );
}
