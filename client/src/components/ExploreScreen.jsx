import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CATEGORIES, DESTINATIONS } from "../lib/destinations.js";
import { useIdeaDeck } from "../lib/useIdeaDeck.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";
import { PlaceIdeas } from "./PlaceIdeas.jsx";

export function ExploreScreen() {
  const navigate = useNavigate();
  const { profile, trips } = useTravel();
  const ideas = useIdeaDeck({ profile, trips });
  const [params] = useSearchParams();
  const [active, setActive] = useState(params.get("tag") || "all");
  const [q, setQ] = useState("");
  const showIdeas = ideas.source !== "starter" && active === "all" && !q.trim();

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return DESTINATIONS.filter((d) => {
      const hay = `${d.name} ${d.country} ${d.vibe}`.toLowerCase();
      const catOk = active === "all" || (d.tags || []).includes(active);
      return catOk && (!query || hay.includes(query));
    });
  }, [q, active]);

  const goPlan = (label) => {
    const dest = String(label || "").trim();
    if (!dest) return;
    navigate(`/plan?q=${encodeURIComponent(dest)}`);
  };

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Ideas</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">Type any city, or tap a postcard.</h1>
      <div className="mt-5">
        <DestinationSuggest
          value={q}
          placeholder="Lucknow, Bali, Kyoto…"
          onChange={setQ}
          onSelect={(place) => {
            if (place?.label) goPlan(place.label);
          }}
        />
      </div>

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        <Chip active={active === "all"} onClick={() => setActive("all")}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={active === c.id} onClick={() => setActive(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {showIdeas ? <PlaceIdeas deck={ideas} onOpen={goPlan} /> : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        {list.length === 0 && (
          <div className="card col-span-2 rounded-[1.4rem] px-4 py-6 text-center">
            <p className="serif text-xl">No postcards in that filter.</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Type any city above — Safar can plan places that are not on this wall.</p>
          </div>
        )}
        {list.map((d, i) => (
          <button
            key={d.id}
            type="button"
            className={`card relative overflow-hidden rounded-[1.35rem] text-left ${i === 0 ? "col-span-2" : ""}`}
            onClick={() => goPlan(`${d.name}, ${d.country}`)}
          >
            <img src={d.image} alt="" className={i === 0 ? "h-44 w-full object-cover" : "h-36 w-full object-cover"} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="serif text-xl font-semibold leading-none">{d.name}</p>
              <p className="mt-1 text-[0.7rem] text-[#d0c9bc]">
                {d.country} · {d.from}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-xs ${
        active
          ? "bg-[var(--gold)] text-[#1a140c]"
          : "border border-[var(--line)] bg-[rgba(20,28,47,0.7)] text-[#d8d2c6]"
      }`}
    >
      {children}
    </button>
  );
}
