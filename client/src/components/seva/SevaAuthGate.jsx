import { useState } from "react";
import { Link } from "react-router-dom";
import { useSeva } from "./SevaProvider.jsx";

export function SevaAuthGate() {
  const { setSession } = useSeva();
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/seva/villages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        await setSession({
          token: data.token,
          villageId: data.village._id,
          villageCode: data.village.code,
          villageName: data.village.name,
        });
      } else {
        const res = await fetch(
          `/api/seva/villages/${encodeURIComponent(code.trim().toUpperCase())}/join`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
          },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        await setSession({
          token: data.token,
          villageId: data.village._id,
          villageCode: data.village.code,
          villageName: data.village.name,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "कुछ गलत हुआ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <Link to="/" className="mb-6 text-sm font-semibold text-stone-500">
        ← Village
      </Link>
      <div className="mb-8 text-center">
        <p className="text-5xl" aria-hidden>
          🛠️
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-sky-950">
          ग्रामसेवा
        </h1>
        <p className="mt-2 text-lg text-stone-600">
          मिस्त्री, बिजली, मजदूर — पड़ोसी से सीधा काम
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
        <button
          type="button"
          className={`min-h-12 rounded-xl text-base font-bold ${
            mode === "create" ? "bg-white text-sky-900 shadow" : "text-stone-500"
          }`}
          onClick={() => setMode("create")}
        >
          नया गाँव
        </button>
        <button
          type="button"
          className={`min-h-12 rounded-xl text-base font-bold ${
            mode === "join" ? "bg-white text-sky-900 shadow" : "text-stone-500"
          }`}
          onClick={() => setMode("join")}
        >
          जुड़ें
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "create" ? (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-stone-600">
              गाँव का नाम
            </span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
              placeholder="जैसे: रामपुर"
            />
          </label>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-stone-600">
              गाँव कोड
            </span>
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-center text-2xl font-black tracking-[0.3em]"
              placeholder="ABC123"
              maxLength={8}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-stone-600">
            4 अंक का पिन
          </span>
          <input
            required
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-center text-3xl font-black tracking-[0.5em]"
            placeholder="••••"
          />
        </label>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center font-semibold text-red-800">
            {error}
          </p>
        ) : null}

        <button
          disabled={busy}
          className="min-h-16 w-full rounded-2xl bg-sky-800 text-xl font-black text-white disabled:opacity-50"
        >
          {busy ? "रुकिए…" : mode === "create" ? "गाँव बनाएं" : "अंदर जाएं"}
        </button>
      </form>
    </div>
  );
}
