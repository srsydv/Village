import { formatTripSpan } from "../lib/dates.js";
import { WeatherStrip } from "./PlacePicker.jsx";

export function ItineraryView({ plan, weather, showDates = true }) {
  if (!plan) return null;
  const budgetEntries = Object.entries(plan.budget || {}).filter(([, v]) => v);
  const span = formatTripSpan(plan.startDate, plan.daysCount) || plan.duration;

  return (
    <div>
      {plan.summary && <p className="mt-4 text-[0.95rem] leading-relaxed text-[#d8d2c6]">{plan.summary}</p>}
      {showDates && (span || plan.bestTime) ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          {span}
          {plan.bestTime ? ` · Best ${plan.bestTime}` : ""}
        </p>
      ) : null}
      {weather && (
        <div className="mt-4">
          <WeatherStrip weather={weather} />
        </div>
      )}

      {budgetEntries.length > 0 && (
        <section className="card mt-6 rounded-[1.4rem] p-4">
          <p className="kicker">Expenses</p>
          <p className="mt-1 text-[0.7rem] text-[var(--muted)]">Estimates. Live prices open on Booking or airline sites.</p>
          <div className="mt-3 space-y-2">
            {budgetEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 text-sm">
                <span className="capitalize text-[var(--muted)]">{key}</span>
                <span className="text-right text-[#f0e8da]">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <VisaBlock visa={plan.visa} />

      {plan.hotels?.length > 0 && (
        <section className="mt-7">
          <h2 className="serif text-2xl font-semibold">Stay areas</h2>
          <div className="mt-3 space-y-3">
            {plan.hotels.map((hotel, i) => (
              <article key={`${hotel.name}-${i}`} className="card rounded-[1.3rem] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{hotel.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {hotel.area}
                      {hotel.tier ? ` · ${hotel.tier}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-[var(--gold-bright)]">{hotel.pricePerNight}</p>
                </div>
                {hotel.why && <p className="mt-2 text-sm text-[#d8d2c6]">{hotel.why}</p>}
                {hotel.bookingTip && <p className="mt-2 text-xs text-[var(--muted)]">{hotel.bookingTip}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {plan.days?.length > 0 && (
        <section className="mt-7">
          <h2 className="serif text-2xl font-semibold">Days</h2>
          <div className="mt-3 space-y-3">
            {plan.days.map((day) => (
              <article key={day.day} className="card rounded-[1.3rem] p-4">
                <p className="kicker">Day {day.day}</p>
                <h3 className="serif mt-1 text-xl font-semibold">{day.title}</h3>
                <DayLine label="Morning" text={day.morning} />
                <DayLine label="Afternoon" text={day.afternoon} />
                <DayLine label="Evening" text={day.evening} />
                {day.food && <DayLine label="Food" text={day.food} />}
                {day.cost && <p className="mt-2 text-xs text-[var(--gold)]">{day.cost}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {plan.food?.length > 0 && <BulletBlock title="Taste" items={plan.food} />}
      {plan.packing?.length > 0 && <BulletBlock title="Pack" items={plan.packing} />}
      {plan.tips?.length > 0 && <BulletBlock title="Concierge notes" items={plan.tips} />}
      {plan.safety && (
        <section className="card mt-3 rounded-[1.3rem] p-4">
          <p className="kicker">Safety</p>
          <p className="mt-2 text-sm leading-relaxed text-[#d8d2c6]">{plan.safety}</p>
        </section>
      )}
      <p className="mt-6 text-[0.65rem] leading-relaxed text-[var(--muted)]">
        AI-generated. Check visas, prices, and opening hours before you travel.
      </p>
    </div>
  );
}

function VisaBlock({ visa }) {
  if (!visa) return null;
  const text = typeof visa === "string" ? visa : [visa.youApply, visa.type, visa.timeline].filter(Boolean).join(" ");
  return (
    <section className="card mt-6 rounded-[1.3rem] p-4">
      <p className="kicker">Visa (you apply)</p>
      <p className="mt-2 text-sm leading-relaxed text-[#d8d2c6]">{text}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Aurea explains the steps. You file on the official site. We do not collect documents or guarantee approval.
      </p>
    </section>
  );
}

function DayLine({ label, text }) {
  if (!text) return null;
  return (
    <p className="mt-2 text-sm leading-relaxed text-[#d8d2c6]">
      <span className="text-[var(--gold)]">{label}. </span>
      {text}
    </p>
  );
}

function BulletBlock({ title, items }) {
  return (
    <section className="mt-7">
      <h2 className="serif text-2xl font-semibold">{title}</h2>
      <ul className="card mt-3 list-disc space-y-1.5 rounded-[1.3rem] px-7 py-4 text-sm text-[#d8d2c6]">
        {items.map((item, i) => (
          <li key={`${item}-${i}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
