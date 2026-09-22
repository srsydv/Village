import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPlan, fetchPlaces, suggestPlaces } from "../lib/api.js";
import { formatTripSpan, travelerLine, tomorrowIso, tripEndIso } from "../lib/dates.js";
import { emptyPicks, pickCount, togglePick } from "../lib/links.js";
import { uid } from "../lib/storage.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";
import { ItineraryView } from "./ItineraryView.jsx";
import { PlacePicker } from "./PlacePicker.jsx";

const STYLES = ["Balanced", "Luxury", "Budget", "Adventure", "Family", "Honeymoon"];

export function PlanScreen() {
  const { profile, addTrip } = useTravel();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const incoming = params.get("q") || "";
  const incomingDays = params.get("days") || "";
  const incomingStart = params.get("start") || "";
  const incomingNotes = params.get("notes") || "";
  const [form, setForm] = useState({
    destination: incoming,
    startDate: incomingStart || tomorrowIso(),
    days: incomingDays || "6",
    adults: 2,
    kids: 0,
    budget: "",
    style: "Balanced",
    interests: "",
    notes: incomingNotes,
  });
  const [step, setStep] = useState("form");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [picks, setPicks] = useState(emptyPicks);
  const [tab, setTab] = useState("stays");
  const [pickedPlace, setPickedPlace] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!incoming && !incomingNotes && !incomingDays && !incomingStart) return;
    setForm((f) => ({
      ...f,
      destination: incoming || f.destination,
      days: incomingDays || f.days,
      startDate: incomingStart || f.startDate,
      notes: incomingNotes || f.notes,
    }));
  }, [incoming, incomingDays, incomingNotes, incomingStart]);

  const packedPlan = (nextPlan, destination, country) => {
    const daysCount = Number(form.days) || 6;
    return {
      ...(nextPlan || {}),
      destination: destination || nextPlan?.destination,
      country: country || nextPlan?.country,
      startDate: form.startDate,
      endDate: tripEndIso(form.startDate, daysCount),
      daysCount,
      duration: formatTripSpan(form.startDate, daysCount) || `${daysCount} days`,
      travelers: travelerLine(form.adults, form.kids),
    };
  };

  const generate = async () => {
    setError("");
    setBusy(true);
    setPhase("Looking up that place…");
    try {
      let place = pickedPlace;
      if (!place?.label) {
        const hits = await suggestPlaces(form.destination).catch(() => []);
        place = hits[0] || null;
        if (place) {
          setPickedPlace(place);
          setForm((f) => ({ ...f, destination: place.label }));
        }
      }
      const destination = place?.label || form.destination.trim();
      setPhase("Writing your days and finding stays…");
      const payload = {
        ...form,
        destination,
        country: place?.country || "",
        travelers: travelerLine(form.adults, form.kids),
        startDate: form.startDate,
        endDate: tripEndIso(form.startDate, form.days),
        profile,
      };
      const [nextPlan, nextCatalog] = await Promise.all([
        createPlan(payload),
        fetchPlaces(destination).catch(() => null),
      ]);
      setPlan(packedPlan(nextPlan, destination, place?.country));
      setCatalog(nextCatalog);
      setPicks(emptyPicks());
      setStep("itinerary");
      if (!nextCatalog) setError("Plan is ready. Live hotels could not load — you can still save.");
    } catch (err) {
      setError(err.message || "Could not create this plan. Check your connection and try again.");
    } finally {
      setBusy(false);
      setPhase("");
    }
  };

  const save = (nextPicks = picks) => {
    const destination = plan?.destination || form.destination;
    const trip = {
      id: uid(),
      createdAt: Date.now(),
      plan: plan || packedPlan(null, destination, pickedPlace?.country),
      picks: nextPicks,
      weather: catalog?.weather || null,
    };
    addTrip(trip);
    navigate(`/trips/${trip.id}`);
  };

  if (step === "picks") {
    return (
      <div className="safe-top safe-bottom px-5">
        <button type="button" className="text-sm text-[var(--gold)]" onClick={() => setStep("itinerary")}>
          ← Back to itinerary
        </button>
        <p className="kicker mt-4">Optional</p>
        <h1 className="serif mt-1 text-[2rem] leading-tight font-semibold">Pin stays, food, and sights.</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {form.destination}. Live prices open on Booking or Maps — the plan amounts are estimates.
        </p>
        {error && <p className="mt-3 text-sm text-[var(--rose)]">{error}</p>}
        {catalog ? (
          <div className="mt-4">
            <PlacePicker
              catalog={catalog}
              picks={picks}
              tab={tab}
              onTab={setTab}
              onToggle={(place) => setPicks((curr) => togglePick(curr, place))}
            />
          </div>
        ) : (
          <p className="card mt-4 rounded-2xl px-4 py-4 text-sm text-[var(--muted)]">
            Live listings were unavailable. Save the written plan as it is.
          </p>
        )}
        <button type="button" className="btn-gold mt-5 w-full rounded-2xl py-3.5 text-sm font-semibold" onClick={() => save()}>
          {pickCount(picks) ? `Save trip · ${pickCount(picks)} picks` : "Save without picks"}
        </button>
      </div>
    );
  }

  if (step === "itinerary") {
    return (
      <div className="safe-top safe-bottom px-5 pb-8">
        <button type="button" className="text-sm text-[var(--gold)]" onClick={() => setStep("form")}>
          ← Edit details
        </button>
        <p className="kicker mt-4">{plan?.country || "Itinerary"}</p>
        <h1 className="serif mt-1 text-[2.15rem] leading-tight font-semibold">
          {plan?.title || plan?.destination || form.destination}
        </h1>
        {error && <p className="mt-3 text-sm text-[var(--rose)]">{error}</p>}
        <ItineraryView plan={plan} weather={catalog?.weather} />
        <div className="mt-8 space-y-2">
          {plan && (
            <button
              type="button"
              className="btn-gold w-full rounded-2xl py-3.5 text-sm font-semibold"
              onClick={() => save()}
            >
              Save this plan
            </button>
          )}
          {catalog && (
            <button
              type="button"
              className="w-full rounded-2xl border border-[var(--line)] py-3 text-sm text-[#d8d2c6]"
              onClick={() => setStep("picks")}
            >
              Pick stays and food
            </button>
          )}
          <button
            type="button"
            className="w-full rounded-2xl py-3 text-sm text-[var(--gold)]"
            disabled={busy}
            onClick={generate}
          >
            {busy ? phase || "Regenerating…" : "Regenerate"}
          </button>
        </div>
        {busy && <PlanBusy phase={phase} />}
      </div>
    );
  }

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Plan</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">Where are you going?</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Pick a real place, dates, and who is travelling. Safar writes the itinerary first. Hotels are optional after
        that. Plans are AI-generated and can be wrong. Visa steps are for you to file — we do not apply for you.
        {profile.nationality ? ` Advice uses a ${profile.nationality} passport.` : ""}
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
      >
        <Field label="Destination">
          <DestinationSuggest
            value={form.destination}
            required
            placeholder="Start typing a city…"
            onChange={(destination) => setForm((f) => ({ ...f, destination }))}
            onSelect={setPickedPlace}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input className="field" type="date" value={form.startDate} onChange={set("startDate")} required />
          </Field>
          <Field label="Days">
            <input className="field" type="number" min="2" max="30" value={form.days} onChange={set("days")} />
          </Field>
        </div>
        <p className="text-xs text-[var(--muted)]">{formatTripSpan(form.startDate, form.days)}</p>
        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label="Adults"
            value={form.adults}
            min={1}
            max={12}
            onChange={(adults) => setForm((f) => ({ ...f, adults }))}
          />
          <Stepper
            label="Children"
            value={form.kids}
            min={0}
            max={8}
            onChange={(kids) => setForm((f) => ({ ...f, kids }))}
          />
        </div>
        <Field label={`Budget (${profile.currency})`}>
          <input
            className="field"
            placeholder={profile.currency === "INR" ? "Optional — e.g. 1.2 lakh" : "Optional — e.g. 2500"}
            value={form.budget}
            onChange={set("budget")}
          />
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
          <textarea
            className="field"
            placeholder="First trip abroad, parents travelling, vegetarian food…"
            value={form.notes}
            onChange={set("notes")}
          />
        </Field>

        {error && <p className="text-sm text-[var(--rose)]">{error}</p>}

        <div className="sticky bottom-[calc(6.1rem+env(safe-area-inset-bottom))] z-30 bg-[#070b14] pt-3 pb-1">
          <button type="submit" disabled={busy || !form.destination.trim()} className="btn-gold w-full rounded-2xl py-3.5 text-sm font-semibold">
            {busy ? phase || "Working…" : plan ? "Generate again" : "Write my plan"}
          </button>
        </div>
      </form>
      {busy && <PlanBusy phase={phase} />}
    </div>
  );
}

function PlanBusy({ phase }) {
  const steps = ["Looking up that place…", "Writing your days and finding stays…"];
  const active = phase?.includes("Writing") ? 1 : 0;
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/45 px-4 pb-[calc(6.4rem+env(safe-area-inset-bottom))]">
      <div className="card w-full rounded-[1.5rem] p-5">
        <p className="kicker">Working</p>
        <p className="serif mt-1 text-2xl font-semibold">{phase || "Writing your plan…"}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">This usually takes 15–30 seconds. Stay on this screen.</p>
        <ol className="mt-4 space-y-2 text-sm">
          {steps.map((label, i) => (
            <li key={label} className={i === active ? "text-[var(--gold-bright)]" : "text-[var(--muted)]"}>
              {i < active ? "✓" : i === active ? "●" : "○"} {label}
            </li>
          ))}
        </ol>
      </div>
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

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div>
      <span className="mb-1.5 block text-[0.7rem] tracking-wide text-[var(--muted)] uppercase">{label}</span>
      <div className="field flex items-center justify-between">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-xl text-lg text-[var(--gold)]"
          onClick={() => onChange(Math.max(min, Number(value) - 1))}
        >
          −
        </button>
        <span className="text-sm">{value}</span>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-xl text-lg text-[var(--gold)]"
          onClick={() => onChange(Math.min(max, Number(value) + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}
