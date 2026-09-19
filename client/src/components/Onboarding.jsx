import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";
import { GoogleSignIn } from "./GoogleSignIn.jsx";

export function Onboarding() {
  const { completeGoogleSignIn, completeOnboarding, signOut, signedIn, account, profile } = useTravel();
  const [name, setName] = useState(profile.name || account?.name || "");
  const [homeCity, setHomeCity] = useState(profile.homeCity || "");
  const [currency, setCurrency] = useState(profile.currency || "INR");

  useEffect(() => {
    if (!signedIn) return;
    setName((current) => current || profile.name || account?.name || "");
    setHomeCity((current) => current || profile.homeCity || "");
    setCurrency((current) => current || profile.currency || "INR");
  }, [account, profile, signedIn]);

  const onSignedIn = useCallback((data) => completeGoogleSignIn(data), [completeGoogleSignIn]);

  const canContinue = Boolean(name.trim() && homeCity.trim());

  return (
    <div className="relative min-h-dvh text-[var(--cream)]">
      <img
        src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#070B14]/45 to-[#070B14]" />
      <div className="relative flex min-h-dvh flex-col justify-end px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <p className="kicker">Aurea</p>
        {signedIn ? (
          <>
            <h1 className="serif mt-3 text-[2.55rem] leading-[1.05] font-semibold">Tell Aurea who is travelling.</h1>
            <p className="mt-3 max-w-[22rem] text-[0.95rem] leading-relaxed text-[#d8d2c6]">
              Signed in as {account?.email}. Name, hometown, and currency go into every plan.
            </p>
            <div className="mt-6 space-y-3">
              <input
                className="field"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
                <option value="INR">INR — Indian Rupee</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — Pound</option>
                <option value="AED">AED — Dirham</option>
              </select>
            </div>
            <button
              type="button"
              className="btn-gold mt-6 w-full rounded-2xl py-3.5 text-[0.95rem] font-semibold"
              disabled={!canContinue}
              onClick={() =>
                completeOnboarding({
                  name: name.trim(),
                  homeCity: homeCity.trim(),
                  currency,
                })
              }
            >
              Start planning
            </button>
            <button type="button" className="mt-3 w-full py-2 text-sm text-[var(--rose)]" onClick={signOut}>
              Log out
            </button>
          </>
        ) : (
          <>
            <h1 className="serif mt-3 text-[2.55rem] leading-[1.05] font-semibold">Sign in to plan with Aurea.</h1>
            <p className="mt-3 max-w-[22rem] text-[0.95rem] leading-relaxed text-[#d8d2c6]">
              Continue with Google. Then add your name, hometown, and currency. There is no guest mode.
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
