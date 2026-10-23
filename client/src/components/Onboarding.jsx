import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { checkUsername } from "../lib/api.js";
import { formatPhone } from "../lib/phone.js";
import { CURRENCY_OPTIONS } from "../lib/profileOptions.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";
import { GoogleSignIn } from "./GoogleSignIn.jsx";
import { PassportSelect } from "./PassportSelect.jsx";

export function Onboarding() {
  const { completeGoogleSignIn, completeOnboarding, signOut, signedIn, account, profile } = useTravel();
  const [name, setName] = useState(profile.name || account?.name || "");
  const [homeCity, setHomeCity] = useState(profile.homeCity || "");
  const [currency, setCurrency] = useState(profile.currency || "INR");
  const [nationality, setNationality] = useState(profile.nationality || "India");
  const [username, setUsername] = useState(profile.username || "");
  const [phone, setPhone] = useState(formatPhone(profile.phone));
  const [usernameNote, setUsernameNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    setName((current) => current || profile.name || account?.name || "");
    setHomeCity((current) => current || profile.homeCity || "");
    setCurrency((current) => current || profile.currency || "INR");
    setNationality((current) => current || profile.nationality || "India");
    setUsername((current) => current || profile.username || "");
    setPhone((current) => current || formatPhone(profile.phone));
  }, [account, profile, signedIn]);

  useEffect(() => {
    const q = username.trim();
    if (q.length < 3) {
      setUsernameNote("");
      return undefined;
    }
    let cancel = false;
    const timer = setTimeout(() => {
      checkUsername(q)
        .then((result) => {
          if (cancel) return;
          setUsernameNote(result.error || (result.available ? "Available" : "That username is taken."));
        })
        .catch(() => {
          if (!cancel) setUsernameNote("");
        });
    }, 400);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [username]);

  const onSignedIn = useCallback((data) => completeGoogleSignIn(data), [completeGoogleSignIn]);

  const canContinue = Boolean(
    name.trim() &&
      homeCity.trim() &&
      username.trim().replace(/^@+/, "").length >= 3 &&
      phone.replace(/\D/g, "").length >= 10,
  );

  return (
    <div className="relative min-h-dvh text-[var(--cream)]">
      <img
        src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#070B14]/45 to-[#070B14]" />
      <div className="relative flex min-h-dvh flex-col justify-end px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <p className="kicker">Safar</p>
        {signedIn ? (
          <>
            <h1 className="serif mt-3 text-[2.55rem] leading-[1.05] font-semibold">Tell Safar who is travelling.</h1>
            <p className="mt-3 max-w-[22rem] text-[0.95rem] leading-relaxed text-[#d8d2c6]">
              Signed in as {account?.email}. Add a username and phone so friends can share trips with you.
            </p>
            <div className="mt-6 space-y-3">
              <input
                className="field"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div>
                <input
                  className="field"
                  placeholder="Username — priya"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                />
                <p className={`mt-1.5 text-xs ${usernameNote === "Available" ? "text-[var(--gold)]" : usernameNote ? "text-[var(--rose)]" : "text-[var(--muted)]"}`}>
                  {usernameNote || "Friends find you as @username. Letters, numbers, underscore."}
                </p>
              </div>
              <div>
                <input
                  className="field"
                  placeholder="Phone — 98765 43210"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-[var(--muted)]">10 digits uses +91. Or include your country code.</p>
              </div>
              <DestinationSuggest
                value={homeCity}
                placeholder="Hometown — e.g. Azamgarh, Mumbai"
                required
                onChange={setHomeCity}
                onSelect={(place) => {
                  if (place?.label) setHomeCity(place.label);
                }}
              />
              <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <PassportSelect value={nationality} onChange={setNationality} />
            </div>
            <button
              type="button"
              className="btn-gold mt-6 w-full rounded-2xl py-3.5 text-[0.95rem] font-semibold"
              disabled={!canContinue || saving}
              onClick={async () => {
                setError("");
                setSaving(true);
                try {
                  await completeOnboarding({
                    name: name.trim(),
                    homeCity: homeCity.trim(),
                    currency,
                    nationality,
                    username: username.trim(),
                    phone: phone.trim(),
                  });
                } catch (err) {
                  setError(err.message || "Could not save your profile.");
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Start planning"}
            </button>
            {error && <p className="mt-3 text-sm text-[var(--rose)]">{error}</p>}
            <button type="button" className="mt-3 w-full py-2 text-sm text-[var(--rose)]" onClick={signOut}>
              Log out
            </button>
          </>
        ) : (
          <>
            <h1 className="serif mt-3 text-[2.55rem] leading-[1.05] font-semibold">Sign in to plan with Safar.</h1>
            <p className="mt-3 max-w-[22rem] text-[0.95rem] leading-relaxed text-[#d8d2c6]">
              Continue with Google. Then add your name, username, and phone so friends can find you. There is no guest mode.
            </p>
            <div className="mt-8">
              <GoogleSignIn onSignedIn={onSignedIn} />
            </div>
            <Link to="/privacy" className="mt-6 block text-center text-xs text-[var(--muted)]">
              Privacy policy
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
