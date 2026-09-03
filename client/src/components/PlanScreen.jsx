import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPlan, fetchPlaces } from "../lib/api.js";
import { emptyPicks, pickCount, togglePick } from "../lib/links.js";
import { uid } from "../lib/storage.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { PlacePicker, WeatherStrip } from "./PlacePicker.jsx";

const STYLES = ["Balanced", "Luxury", "Budget", "Adventure", "Family", "Honeymoon"];

export function PlanScreen() {
  const { profile, addTrip } = useTravel();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    destination: "",
    days: "6",
    travelers: "2 adults",
    budget: "",
    style: "Balanced",
    interests: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [picks, setPicks] = useState(emptyPicks);
  const [tab, setTab] = useState("stays");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = (nextPicks = picks, nextPlan = plan, nextCatalog = catalog) => {
    const trip = {
      id: uid(),
      createdAt: Date.now(),
      plan: nextPlan || {
        title: `Trip to ${form.destination}`,
        destination: form.destination,
        duration: `${form.days} days`,
      },
      picks: nextPicks,
      weather: nextCatalog?.weather || null,
    };
    addTrip(trip);
    navigate(`/trips/${trip.id}`);
  };

  if (plan || catalog) {
    return (
      <div className="safe-top safe-bottom px-5">
        <p className="kicker">Choose</p>
        <h1 className="serif mt-1 text-[2rem] leading-tight font-semibold">
          Now pick your stay, food, and sights.
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {form.destination}
          {plan?.title ? ` · ${plan.title}` : ""}
        </p>
        {catalog?.weather && <div className="mt-4"><WeatherStrip weather={catalog.weather} /></div>}
        {error && <p className="mb-3 text-sm text-[var(--rose)]">{error}</p>}
        {catalog ? (
          <PlacePicker
            catalog={catalog}
            picks={picks}
            tab={tab}
            onTab={setTab}
            onToggle={(place) => setPicks((curr) => togglePick(curr, place))}
          />
        ) : (
          <p className="card mt-4 rounded-2xl px-4 py-4 text-sm text-[var(--muted)]">
            Live listings were unavailable. You can still save the written plan.
          </p>
        )}
        <button
          type="button"
          className="btn-gold mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold"
          onClick={() => save()}
        >
          {pickCount(picks) ? `Save trip · ${pickCount(picks)} picks` : "Save plan without picks"}
        </button>
      </div>
    );
  }

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Plan</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">A complete trip, designed for you.</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Aurea writes the itinerary. Then you choose real hotels, restaurants, and sights on the map.
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            const [nextPlan, nextCatalog] = await Promise.all([
              createPlan({ ...form, profile }).catch((err) => {
                throw err;
              }),
              fetchPlaces(form.destination).catch(() => null),
            ]);
            setPlan(nextPlan);
            setCatalog(nextCatalog);
            if (!nextCatalog) setError("Plan is ready. Listings could not load — you can still save.");
          } catch (err) {
            try {
              const nextCatalog = await fetchPlaces(form.destination);
              setCatalog(nextCatalog);
              setError("The written plan failed, but you can still pick live stays and food.");
            } catch {
              setError(err.message || "Could not create this plan.");
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Destination">
          <input className="field" placeholder="Kyoto, Bali, Udaipur…" value={form.destination} onChange={set("destination")} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Days">
            <input className="field" type="number" min="2" max="30" value={form.days} onChange={set("days")} />
          </Field>
          <Field label="Travelers">
            <input className="field" value={form.travelers} onChange={set("travelers")} />
          </Field>
        </div>
        <Field label={`Budget (${profile.currency})`}>
          <input className="field" placeholder="Optional — e.g. 1.2 lakh" value={form.budget} onChange={set("budget")} />
        </Field>
        <Field label="Style">
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, style: s }))}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  form.style === s
                    ? "bg-[var(--gold)] text-[#1a140c]"
                    : "border border-[var(--line)] text-[#d8d2c6]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Interests">
          <input className="field" placeholder="Food, temples, nightlife…" value={form.interests} onChange={set("interests")} />
        </Field>
        <Field label="Anything else">
          <textarea className="field" placeholder="Kids, visa help, first time abroad…" value={form.notes} onChange={set("notes")} />
        </Field>

        {error && <p className="text-sm text-[var(--rose)]">{error}</p>}

        <button type="submit" disabled={busy} className="btn-gold mt-2 w-full rounded-2xl py-3.5 text-sm font-semibold">
          {busy ? "Finding places and drafting your plan…" : "Find options"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[0.7rem] tracking-wide text-[var(--muted)] uppercase">{label}</span>
      {children}
    </label>
  );
}
