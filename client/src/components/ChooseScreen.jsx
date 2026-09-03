import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchPlaces } from "../lib/api.js";
import { emptyPicks, pickCount, togglePick } from "../lib/links.js";
import { uid } from "../lib/storage.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { PlacePicker, WeatherStrip } from "./PlacePicker.jsx";

export function ChooseScreen() {
  const { addTrip, trips } = useTravel();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = params.get("q") || "";
  const tripId = params.get("trip");
  const [query, setQuery] = useState(initial);
  const [catalog, setCatalog] = useState(null);
  const [picks, setPicks] = useState(emptyPicks);
  const [tab, setTab] = useState("stays");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async (q) => {
    const dest = String(q || "").trim();
    if (!dest) return;
    setBusy(true);
    setError("");
    try {
      const data = await fetchPlaces(dest);
      setCatalog(data);
      const existing = trips.find((t) => t.id === tripId);
      setPicks(existing?.picks || emptyPicks());
    } catch (err) {
      setCatalog(null);
      setError(err.message || "Could not load options.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initial) load(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const city = catalog?.place?.city || catalog?.place?.name || query;

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Choose</p>
      <h1 className="serif mt-1 text-[2.05rem] leading-tight font-semibold">Pick stays, food, and sights.</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Live listings from OpenStreetMap. Weather from Open-Meteo. Booking opens partner sites.
      </p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          load(query);
        }}
      >
        <input
          className="field"
          placeholder="Jaipur, Goa, Kyoto…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-gold shrink-0 rounded-2xl px-4 text-sm font-semibold" disabled={busy}>
          {busy ? "…" : "Find"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-[var(--rose)]">{error}</p>}

      {busy && !catalog && (
        <p className="mt-6 text-sm text-[var(--muted)]">Looking up mapped hotels, restaurants, and sights…</p>
      )}

      {catalog && (
        <div className="mt-5">
          {catalog.about?.extract && (
            <p className="mb-4 text-sm leading-relaxed text-[#d8d2c6]">{catalog.about.extract.slice(0, 220)}…</p>
          )}
          <WeatherStrip weather={catalog.weather} />
          <PlacePicker
            catalog={catalog}
            picks={picks}
            tab={tab}
            onTab={setTab}
            onToggle={(place) => setPicks((curr) => togglePick(curr, place))}
          />
          <button
            type="button"
            className="btn-gold mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold"
            disabled={pickCount(picks) === 0}
            onClick={() => {
              const id = tripId || uid();
              const previous = trips.find((t) => t.id === id);
              addTrip({
                id,
                createdAt: previous?.createdAt || Date.now(),
                plan: previous?.plan || {
                  title: `Trip to ${city}`,
                  destination: city,
                  country: catalog.place?.country,
                  summary: catalog.about?.extract || `Your selected stays, food, and sights in ${city}.`,
                },
                picks,
                weather: catalog.weather,
              });
              navigate(`/trips/${id}`);
            }}
          >
            Save {pickCount(picks)} pick{pickCount(picks) === 1 ? "" : "s"}
          </button>
        </div>
      )}
    </div>
  );
}
