import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPlan } from "../lib/api.js";
import { uid } from "../lib/storage.js";
import { useTravel } from "../lib/TravelContext.jsx";

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

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Plan</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">A complete trip, designed for you.</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Aurea will draft hotels, a day-by-day path, and a {profile.currency} expense split.
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            const plan = await createPlan({ ...form, profile });
            const trip = {
              id: uid(),
              createdAt: Date.now(),
              plan,
            };
            addTrip(trip);
            navigate(`/trips/${trip.id}`);
          } catch (err) {
            setError(err.message || "Could not create this plan.");
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
          {busy ? "Designing your journey…" : "Create my trip"}
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
