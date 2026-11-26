import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { suggestWeekend } from "../lib/api.js";
import { readWeekend, writeWeekend } from "../lib/weekend.js";

export function WeekendCard({ profile = {} }) {
  const navigate = useNavigate();
  const homeCity = String(profile?.homeCity || "").trim();
  const [idea, setIdea] = useState(() => (homeCity ? readWeekend(homeCity) : null));
  const [status, setStatus] = useState(() => (homeCity && readWeekend(homeCity) ? "ready" : homeCity ? "loading" : "need-city"));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!homeCity) {
      setStatus("need-city");
      setIdea(null);
      return undefined;
    }
    const cached = readWeekend(homeCity);
    if (cached) {
      setIdea(cached);
      setStatus("ready");
      return undefined;
    }
    let cancelled = false;
    setStatus("loading");
    setError("");
    suggestWeekend(profile)
      .then((next) => {
        if (cancelled || !next?.destination) return;
        writeWeekend(homeCity, next);
        setIdea(next);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Safar could not find a weekend.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [homeCity, profile.currency, profile.nationality, profile]);

  if (status === "need-city") {
    return (
      <section className="card mt-5 rounded-[1.4rem] p-4">
        <p className="kicker">This weekend</p>
        <h2 className="serif mt-1 text-2xl font-semibold">From your city</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Add a home city and Safar will keep one weekend idea here for the week.
        </p>
        <Link to="/profile" className="mt-3 inline-block text-sm text-[var(--gold)]">
          Set home city
        </Link>
      </section>
    );
  }

  if (status === "loading") {
    return (
      <section className="card mt-5 rounded-[1.4rem] p-4">
        <p className="kicker">This weekend</p>
        <p className="mt-2 text-sm text-[#d8d2c6]">
          Looking for a weekend from {homeCity}
          <span className="typing ml-1">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        </p>
      </section>
    );
  }

  if (status === "error" || !idea) {
    return (
      <section className="card mt-5 rounded-[1.4rem] p-4">
        <p className="kicker">This weekend</p>
        <p className="mt-2 text-sm text-[var(--muted)]">{error || "Safar could not find a weekend."}</p>
        <button
          type="button"
          className="mt-3 text-sm text-[var(--gold)]"
          onClick={() => {
            setStatus("loading");
            setError("");
            suggestWeekend(profile)
              .then((next) => {
                writeWeekend(homeCity, next);
                setIdea(next);
                setStatus("ready");
              })
              .catch((err) => {
                setError(err.message || "Safar could not find a weekend.");
                setStatus("error");
              });
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  const label = idea.country ? `${idea.destination}, ${idea.country}` : idea.destination;

  return (
    <button
      type="button"
      className="card mt-5 w-full rounded-[1.4rem] p-4 text-left"
      onClick={() => navigate(`/plan?q=${encodeURIComponent(label)}&days=2`)}
    >
      <p className="kicker">This weekend from {homeCity}</p>
      <h2 className="serif mt-1 text-[1.8rem] leading-tight font-semibold">{idea.destination}</h2>
      {idea.title && idea.title !== idea.destination ? (
        <p className="mt-1 text-sm text-[#d8d2c6]">{idea.title}</p>
      ) : null}
      {idea.summary ? <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{idea.summary}</p> : null}
      <p className="mt-3 text-sm text-[var(--gold)]">Plan these two days</p>
    </button>
  );
}
