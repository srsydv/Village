import { useEffect, useId, useRef, useState } from "react";
import { suggestPlaces } from "../lib/api.js";

export function DestinationSuggest({
  value,
  onChange,
  onSelect,
  placeholder = "Kyoto, Bali, Lucknow…",
  required = false,
  className = "",
}) {
  const listId = useId();
  const wrapRef = useRef(null);
  const skipSuggest = useRef(false);
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const q = String(value || "").trim();
    if (skipSuggest.current) {
      skipSuggest.current = false;
      return;
    }
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      setLoading(false);
      return undefined;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const places = await suggestPlaces(q);
        if (ctrl.signal.aborted) return;
        setHits(places);
        setActive(0);
        setOpen(places.length > 0);
      } catch {
        if (!ctrl.signal.aborted) {
          setHits([]);
          setOpen(false);
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const pick = (place) => {
    if (!place) return;
    skipSuggest.current = true;
    setHits([]);
    setOpen(false);
    onChange(place.label);
    onSelect?.(place);
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`.trim()}>
      <input
        className="field"
        placeholder={placeholder}
        value={value}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          onSelect?.(null);
        }}
        onFocus={() => {
          if (hits.length) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % hits.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {loading && (
        <p className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] tracking-wide text-[var(--muted)] uppercase">
          Looking…
        </p>
      )}
      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="card absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-[1.1rem] py-1"
        >
          {hits.map((place, i) => (
            <li key={place.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`block w-full px-4 py-2.5 text-left text-sm ${
                  i === active ? "bg-[rgba(201,163,106,0.14)] text-[var(--cream)]" : "text-[#d8d2c6]"
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(place)}
              >
                {place.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
