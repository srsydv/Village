import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPlan, fetchPlaces, refreshDays, suggestPlaces } from "../lib/api.js";
import { rememberPlace } from "../lib/placeHistory.js";
import { formatTripSpan, travelerLine, tomorrowIso, tripEndIso } from "../lib/dates.js";
import { emptyPicks, pickCount, togglePick } from "../lib/links.js";
import { uid } from "../lib/storage.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { parseModes } from "../lib/transport.js";
import { parseStays, toggleStay } from "../lib/stays.js";
import { DestinationSuggest } from "./DestinationSuggest.jsx";
import { ItineraryView } from "./ItineraryView.jsx";
import { PlacePicker } from "./PlacePicker.jsx";
import { StayChoices } from "./StayChoices.jsx";
import { TransportPicker } from "./Transport.jsx";

const STYLES = ["Balanced", "Luxury", "Budget", "Adventure", "Family", "Honeymoon"];

export function PlanScreen() {
  const { profile, addTrip } = useTravel();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const incoming = params.get("q") || "";
  const incomingDays = params.get("days") || "";
  const incomingStart = params.get("start") || "";
  const incomingNotes = params.get("notes") || "";
  const incomingOrigin = params.get("origin") || "";
  const incomingModes = params.get("modes") || "";
  const incomingStays = params.get("stays") || "";
  const [form, setForm] = useState({
    origin: incomingOrigin || profile.homeCity || "",
    destination: incoming,
    startDate: incomingStart || tomorrowIso(),
    days: incomingDays || "6",
    adults: 2,
    kids: 0,
    budget: "",
    style: "Balanced",
    interests: "",
    notes: incomingNotes,
    modes: parseModes(incomingModes),
    stays: parseStays(incomingStays),
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
  const [originPlace, setOriginPlace] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!incoming && !incomingNotes && !incomingDays && !incomingStart && !incomingOrigin && !incomingModes && !incomingStays) return;
    setForm((f) => ({
      ...f,
      destination: incoming || f.destination,
      days: incomingDays || f.days,
      startDate: incomingStart || f.startDate,
      notes: incomingNotes || f.notes,
      origin: incomingOrigin || f.origin,
      modes: incomingModes ? parseModes(incomingModes) : f.modes,
      stays: incomingStays ? parseStays(incomingStays) : f.stays,
    }));
  }, [incoming, incomingDays, incomingNotes, incomingStart, incomingOrigin, incomingModes, incomingStays]);

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
      style: nextPlan?.style || form.style || "Balanced",
    };
  };

  const journeyFor = (nextPlan) => ({
    from: form.origin,
    to: nextPlan?.destination || form.destination,
    date: form.startDate,
    adults: form.adults,
    kids: form.kids,
    modes: form.modes,
    originCountry: originPlace?.country || "",
    destCountry: nextPlan?.country || pickedPlace?.country || "",
    rides: nextPlan?.rides,
    flightPicks: nextPlan?.flightPicks,
    currency: profile.currency || nextPlan?.currency,
    profile,
  });

  const generate = async () => {
    setError("");
    if (form.modes.length && !form.origin.trim()) {
      setError("Add the city you are leaving from so Safar can compare train, flight, and bus fares.");
      return;
    }
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
      let originHit = originPlace;
      if ((!originHit?.lat || !originHit?.lon) && form.origin.trim()) {
        const originHits = await suggestPlaces(form.origin).catch(() => []);
        if (originHits[0]) {
          originHit = originHits[0];
          setOriginPlace(originHit);
        }
      }
      const destination = place?.label || form.destination.trim();
      setPhase("Building your days and comparing fares…");
      const payload = {
        ...form,
        origin: form.origin.trim(),
        originLat: originHit?.lat ?? null,
        originLon: originHit?.lon ?? null,
        originCountry: originHit?.country || "",
        destLat: place?.lat ?? null,
        destLon: place?.lon ?? null,
        modes: form.modes,
        stays: form.stays,
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
      rememberPlace({
        name: String(place?.name || destination).split(",")[0],
        country: place?.country || nextPlan?.country || "",
        label: destination,
      });
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
      travel: {
        origin: form.origin.trim(),
        adults: Number(form.adults) || 1,
        kids: Number(form.kids) || 0,
        modes: form.modes,
        stays: form.stays,
        style: form.style,
        originCountry: originPlace?.country || "",
      },
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
        <ItineraryView
          plan={plan}
          weather={catalog?.weather}
          journey={journeyFor(plan)}
          stays={form.stays}
          onToggleStay={(id) => setForm((current) => ({ ...current, stays: toggleStay(current.stays, id) }))}
          onFlightPicks={(flightPicks) => setPlan((current) => (current ? { ...current, flightPicks } : current))}
          onRefreshDays={async (comment) => {
            const days = await refreshDays({
              destination: plan?.destination || form.destination,
              country: plan?.country || pickedPlace?.country || "",
              style: form.style,
              interests: form.interests,
              budget: form.budget,
              travelers: plan?.travelers,
              adults: form.adults,
              kids: form.kids,
              origin: form.origin,
              modes: form.modes,
              stays: form.stays,
              comment,
              profile,
              days: plan?.days,
            });
            setPlan((current) => (current ? { ...current, days } : current));
          }}
        />
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
        Pick a real place, how you want to travel, and who is going. Safar writes the itinerary and ranks train, flight,
        and bus with a booking link. Hotels are optional after that. Plans are AI-generated and can be wrong. Visa steps
        are for you to file — we do not apply for you.
        {profile.nationality ? ` Advice uses a ${profile.nationality} passport.` : ""}
      </p>

      <form
        className="mt-6 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          generate();
        }}
      >
        <Field label="Leaving from">
          <DestinationSuggest
            value={form.origin}
            placeholder={profile.homeCity || "Your city"}
            onChange={(origin) => {
              setOriginPlace(null);
              setForm((f) => ({ ...f, origin }));
            }}
            onSelect={setOriginPlace}
          />
        </Field>
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
        <TransportPicker
          modes={form.modes}
          onToggle={(id) =>
            setForm((f) => ({
              ...f,
              modes: f.modes.includes(id) ? f.modes.filter((mode) => mode !== id) : [...f.modes, id],
            }))
          }
        />
        <StayChoices
          selected={form.stays}
          onToggle={(id) => setForm((current) => ({ ...current, stays: toggleStay(current.stays, id) }))}
        />
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
  const steps = ["Looking up that place…", "Building your days and comparing fares…"];
  const active = phase?.includes("Building") ? 1 : 0;
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/25 px-4 pb-[calc(6.4rem+env(safe-area-inset-bottom))]">
      <div className="card busy-card w-full rounded-[1.6rem] p-5">
        <div className="flex items-center gap-4">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center" aria-hidden="true">
            <span className="plan-ring absolute inset-0" />
            <span className="plan-ring-inner" />
          </span>
          <div className="min-w-0">
            <p className="kicker">Working</p>
            <p className="serif mt-1 text-[1.65rem] leading-tight font-semibold">{phase || "Building your plan…"}</p>
          </div>
        </div>
        <div className="plan-track mt-4">
          <span />
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">A place Safar already knows comes back faster. Stay on this screen.</p>
        <ol className="mt-4 space-y-2.5 text-sm">
          {steps.map((label, i) => (
            <li key={label} className={`flex min-h-6 items-center gap-2.5 ${i === active ? "text-[var(--gold-bright)]" : "text-[var(--muted)]"}`}>
              {i < active ? (
                <span className="grid h-4 w-4 place-items-center text-[0.7rem] text-[var(--gold)]">✓</span>
              ) : i === active ? (
                <span className="plan-dot" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full border border-[var(--line)]" />
              )}
              {label}
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
