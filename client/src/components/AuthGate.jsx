import { useState } from "react";
import { useGroup } from "./GroupProvider.jsx";

export function AuthGate() {
  const { setSession } = useGroup();
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [village, setVillage] = useState("");
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
        const res = await fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, pin, village }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error");
        await setSession({
          token: data.token,
          groupId: data.group._id,
          groupCode: data.group.code,
          groupName: data.group.name,
          village: data.group.village,
        });
      } else {
        const res = await fetch(
          `/api/groups/${encodeURIComponent(code.trim().toUpperCase())}/join`,
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
          groupId: data.group._id,
          groupCode: data.group.code,
          groupName: data.group.name,
          village: data.group.village,
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
      <div className="mb-8 text-center">
        <p className="text-5xl" aria-hidden>
          🤝
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-emerald-950">
          समूह
        </h1>
        <p className="mt-2 text-lg text-stone-600">
          बचत समूह का डिजिटल खाता — कागज़ की जगह
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
        <button
          type="button"
          className={`min-h-12 rounded-xl text-base font-bold ${
            mode === "create" ? "bg-white text-emerald-900 shadow" : "text-stone-500"
          }`}
          onClick={() => setMode("create")}
        >
          नया समूह
        </button>
        <button
          type="button"
          className={`min-h-12 rounded-xl text-base font-bold ${
            mode === "join" ? "bg-white text-emerald-900 shadow" : "text-stone-500"
          }`}
          onClick={() => setMode("join")}
        >
          जुड़ें
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {mode === "create" ? (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-stone-600">
                समूह का नाम
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
                placeholder="जैसे: फूलमती बचत समूह"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-stone-600">
                गाँव (वैकल्पिक)
              </span>
              <input
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
              />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-stone-600">
              समूह कोड
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
          className="min-h-16 w-full rounded-2xl bg-emerald-700 text-xl font-black text-white disabled:opacity-50"
        >
          {busy ? "रुकिए…" : mode === "create" ? "समूह बनाएं" : "अंदर जाएं"}
        </button>
      </form>
    </div>
  );
}
