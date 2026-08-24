import { AVATARS, formatRupees } from "../lib/types.js";
import { useGroup } from "./GroupProvider.jsx";
import { SyncBadge } from "./OfflineBanner.jsx";

const LABELS = {
  savings: { text: "जमा", cls: "bg-emerald-100 text-emerald-900" },
  loan_out: { text: "कर्ज़", cls: "bg-orange-100 text-orange-900" },
  loan_repay: { text: "चुकौती", cls: "bg-sky-100 text-sky-900" },
};

export function HistoryScreen() {
  const { members, transactions, pending, sync } = useGroup();
  const memberName = (id) =>
    members.find((m) => m.id === id)?.displayName ?? "सदस्य";
  const memberAvatar = (id) =>
    AVATARS.find((a) => a.key === members.find((m) => m.id === id)?.avatarKey)
      ?.emoji ?? "👤";

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-emerald-950">खाता</h1>
        <button
          type="button"
          onClick={() => void sync()}
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-stone-800 px-4 font-bold text-white"
        >
          सिंक
          <SyncBadge />
        </button>
      </header>

      {pending > 0 ? (
        <p className="rounded-2xl bg-amber-100 px-4 py-3 font-semibold text-amber-950">
          {pending} एंट्री अभी फोन पर हैं, नेट आने पर भेजेंगे।
        </p>
      ) : null}

      {transactions.length === 0 ? (
        <p className="rounded-2xl bg-stone-100 px-4 py-10 text-center text-lg text-stone-600">
          अभी कोई एंट्री नहीं।
        </p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((t) => {
            const label = LABELS[t.type] || LABELS.savings;
            return (
              <li
                key={t.clientId}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                <span className="text-3xl">{memberAvatar(t.memberId)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">
                    {memberName(t.memberId)}
                  </p>
                  <p className="text-sm text-stone-500">
                    {new Date(t.createdAt).toLocaleString("hi-IN")}
                    {t.pendingSync ? " · सिंक बाकी" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black">{formatRupees(t.amountPaise)}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${label.cls}`}
                  >
                    {label.text}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
