import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORIES, DESTINATIONS } from "../lib/destinations.js";

export function ExploreScreen() {
  const navigate = useNavigate();
  const [active, setActive] = useState("all");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return DESTINATIONS.filter((d) => {
      const hay = `${d.name} ${d.country} ${d.vibe}`.toLowerCase();
      return !query || hay.includes(query);
    });
  }, [q]);

  return (
    <div className="safe-top safe-bottom px-5">
      <p className="kicker">Explore</p>
      <h1 className="serif mt-1 text-[2.1rem] leading-tight font-semibold">Places worth the passport stamp.</h1>
      <input
        className="field mt-5"
        placeholder="Search Kyoto, Bali, Jaipur…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto">
        <Chip active={active === "all"} onClick={() => setActive("all")}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            active={active === c.id}
            onClick={() => {
              setActive(c.id);
              navigate(`/ask?q=${encodeURIComponent(c.prompt)}`);
            }}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {list.map((d, i) => (
          <button
            key={d.id}
            type="button"
            className={`card relative overflow-hidden rounded-[1.35rem] text-left ${i === 0 ? "col-span-2" : ""}`}
            onClick={() => navigate(`/choose?q=${encodeURIComponent(`${d.name}, ${d.country}`)}`)}
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
