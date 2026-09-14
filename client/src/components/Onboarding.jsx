import { useState } from "react";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";

export function Onboarding() {
  const { completeOnboarding } = useTravel();
  const [name, setName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [currency, setCurrency] = useState("INR");

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
        <h1 className="serif mt-3 text-[2.55rem] leading-[1.05] font-semibold">Tell Aurea who is travelling.</h1>
        <p className="mt-3 max-w-[22rem] text-[0.95rem] leading-relaxed text-[#d8d2c6]">
          A name, home city, and currency. Then you type a destination and get a day-by-day plan.
        </p>

        <div className="mt-6 space-y-3">
          <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <DestinationSuggest
            value={homeCity}
            placeholder="Home city — e.g. Mumbai"
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
          onClick={() =>
            completeOnboarding({
              name: name.trim() || "Traveler",
              homeCity: homeCity.trim(),
              currency,
            })
          }
        >
          Start planning
        </button>
      </div>
    </div>
  );
}
