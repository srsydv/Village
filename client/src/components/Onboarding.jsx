import { useState } from "react";
import { useTravel } from "../lib/TravelContext.jsx";

const SLIDES = [
  {
    kicker: "Aurea",
    title: "Ask anything before you fly.",
    copy: "Destinations, visas, hotels, and honest budgets — a private concierge in your pocket.",
    image:
      "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=80",
  },
  {
    kicker: "Plans",
    title: "Itineraries that feel designed.",
    copy: "Day-by-day paths, restaurant picks, and neighborhood stays — not a generic checklist.",
    image:
      "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1400&q=80",
  },
  {
    kicker: "You",
    title: "Tell Aurea who is travelling.",
    copy: "A name, home city, and currency so every estimate feels written for you.",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
  },
];

export function Onboarding() {
  const { completeOnboarding } = useTravel();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [currency, setCurrency] = useState("INR");
  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;

  return (
    <div className="relative min-h-dvh text-[var(--cream)]">
      <img src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-[#070B14]/45 to-[#070B14]" />
      <div className="relative flex min-h-dvh flex-col justify-end px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <p className="kicker">{slide.kicker}</p>
        <h1 className="serif mt-3 text-[2.55rem] leading-[1.05] font-semibold">{slide.title}</h1>
        <p className="mt-3 max-w-[20rem] text-[0.95rem] leading-relaxed text-[#d8d2c6]">{slide.copy}</p>

        {last && (
          <div className="mt-6 space-y-3">
            <input
              className="field"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="field"
              placeholder="Home city (e.g. Mumbai)"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
            />
            <select className="field" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — Pound</option>
              <option value="AED">AED — Dirham</option>
            </select>
          </div>
        )}

        <div className="mt-8 flex items-center gap-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-[var(--gold)]" : "w-2 bg-white/25"}`}
            />
          ))}
        </div>

        <button
          type="button"
          className="btn-gold mt-6 w-full rounded-2xl py-3.5 text-[0.95rem] font-semibold"
          onClick={() => {
            if (!last) {
              setStep((s) => s + 1);
              return;
            }
            completeOnboarding({
              name: name.trim() || "Traveler",
              homeCity: homeCity.trim(),
              currency,
            });
          }}
        >
          {last ? "Begin the journey" : "Continue"}
        </button>
      </div>
    </div>
  );
}
