import { Link } from "react-router-dom";
import { useTravel } from "../lib/TravelContext.jsx";

export function PrivacyScreen() {
  const { profile, updateProfile } = useTravel();

  return (
    <div className="safe-top min-h-dvh px-5 pb-10">
      <Link to="/" className="text-sm text-[var(--gold)]">
        ← Home
      </Link>
      <p className="kicker mt-5">Profile</p>
      <h1 className="serif mt-1 text-[2.1rem] font-semibold">Aurea</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Private travel concierge. Built to publish on the Play Store.</p>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Name</span>
          <input
            className="field"
            value={profile.name}
            onChange={(e) => updateProfile({ name: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Home city</span>
          <input
            className="field"
            value={profile.homeCity}
            onChange={(e) => updateProfile({ homeCity: e.target.value })}
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
          Aurea sends your questions to Google Gemini so it can answer travel questions. Your name, city, and currency
          stay on this device. Chat and trip history are stored only in your browser or phone — not on Aurea servers.
        </p>
        <p className="mt-3">
          We do not sell personal data. Do not share passport numbers, card details, or passwords in chat. Host this
          privacy page at a public URL when you submit the app to Google Play.
        </p>
      </section>
    </div>
  );
}
