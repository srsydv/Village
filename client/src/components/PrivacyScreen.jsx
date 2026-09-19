import { Link } from "react-router-dom";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";

export function PrivacyScreen() {
  const { profile, updateProfile } = useTravel();

  return (
    <div className="safe-top safe-bottom px-5">
      <Link to="/" className="text-sm text-[var(--gold)]">
        ← Home
      </Link>
      <p className="kicker mt-5">You</p>
      <h1 className="serif mt-1 text-[2.1rem] font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Used for budgets and “departing from” in every plan.</p>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Name</span>
          <input className="field" value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Home city</span>
          <DestinationSuggest
            value={profile.homeCity || ""}
            placeholder="Mumbai, Maharashtra, India"
            onChange={(homeCity) => updateProfile({ homeCity })}
            onSelect={(place) => {
              if (place?.label) updateProfile({ homeCity: place.label });
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Currency</span>
          <select
            className="field"
            value={profile.currency}
            onChange={(e) => updateProfile({ currency: e.target.value })}
          >
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="AED">AED</option>
          </select>
        </label>
      </div>

      <section className="card mt-8 rounded-[1.4rem] p-4 text-sm leading-relaxed text-[#d8d2c6]">
        <p className="kicker">Privacy</p>
        <p className="mt-3">
          Aurea sends your questions and plan details to our server, then to Google Gemini, so it can answer. Hotel,
          restaurant, and sight lookups go to OpenStreetMap. Weather comes from Open-Meteo. Your name, city, currency,
          chats, and saved trips stay on this device — not in an Aurea login. We also keep an activity log on our
          server (name, home city, destination or question snippet) so we can see usage. Clearing app data deletes
          on-device history, not that log.
        </p>
        <p className="mt-3">
          Clearing site data deletes saved trips. Share a trip from the trip screen if you want a copy. We do not sell
          personal data. Do not share passport numbers, card details, or passwords in chat.
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Aurea explains visa steps. You apply yourself on the official site. We do not file visas. Plans are AI-generated
          and can be wrong.
        </p>
        <Link to="/privacy" className="mt-4 inline-block text-sm text-[var(--gold)]">
          Full privacy policy
        </Link>
      </section>
    </div>
  );
}
