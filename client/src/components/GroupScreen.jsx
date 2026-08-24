import { useState } from "react";
import { AVATARS } from "../lib/types.js";
import { upsertLocalMember } from "../lib/offline/sync.js";
import { MemberGrid } from "./MemberGrid.jsx";
import { useComputedBalances, useGroup } from "./GroupProvider.jsx";

export function GroupScreen() {
  const { session, refreshLocal } = useGroup();
  const { balances } = useComputedBalances();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarKey, setAvatarKey] = useState("sun");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function addMember(e) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ displayName, avatarKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      await upsertLocalMember(data.member);
      await refreshLocal();
      setDisplayName("");
      setOpen(false);
    } catch (err) {
      setError(
        navigator.onLine
          ? err instanceof Error
            ? err.message
            : "नहीं जुड़ पाया"
          : "सदस्य जोड़ने के लिए इंटरनेट चाहिए",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-emerald-950">सदस्य</h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-12 rounded-2xl bg-emerald-700 px-4 font-bold text-white"
        >
          {open ? "बंद" : "+ जोड़ें"}
        </button>
      </header>

      {open ? (
        <form
          onSubmit={addMember}
          className="space-y-3 rounded-3xl bg-white p-4 shadow-sm"
        >
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="सदस्य का नाम"
            className="min-h-14 w-full rounded-2xl border-2 border-stone-200 px-4 text-lg"
          />
          <div className="grid grid-cols-4 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAvatarKey(a.key)}
                className={`flex min-h-16 flex-col items-center justify-center rounded-2xl text-2xl ${
                  avatarKey === a.key
                    ? "bg-emerald-100 ring-4 ring-emerald-600"
                    : "bg-stone-50"
                }`}
                aria-label={a.label}
              >
                {a.emoji}
              </button>
            ))}
          </div>
          {error ? <p className="font-semibold text-red-800">{error}</p> : null}
          <button
            disabled={busy}
            className="min-h-14 w-full rounded-2xl bg-emerald-700 text-lg font-black text-white disabled:opacity-50"
          >
            सहेजें
          </button>
        </form>
      ) : null}

      <MemberGrid balances={balances} />
    </div>
  );
}
