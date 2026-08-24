import { Link } from "react-router-dom";
import { formatRupees } from "../lib/types.js";
import { useComputedBalances, useGroup } from "./GroupProvider.jsx";
import { InstallPrompt } from "./InstallPrompt.jsx";
import { SyncBadge } from "./OfflineBanner.jsx";

export function HomeScreen() {
  const { session, members, pending, logout } = useGroup();
  const { groupSavingsPaise, groupLoanOutstandingPaise, cashInHandPaise } =
    useComputedBalances();

  return (
    <div className="space-y-4 pb-4">
      <InstallPrompt />
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link to="/" className="text-sm font-semibold text-emerald-800">
            ← Village
          </Link>
          <p className="mt-1 text-sm font-semibold text-emerald-800">समूह</p>
          <h1 className="text-3xl font-black text-emerald-950">
            {session?.groupName}
          </h1>
          <p className="mt-1 font-mono text-lg tracking-widest text-stone-500">
            कोड {session?.groupCode}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SyncBadge />
          <button
            type="button"
            onClick={logout}
            className="text-sm font-semibold text-stone-500"
          >
            बाहर
          </button>
        </div>
      </header>

      <section className="rounded-3xl bg-emerald-800 p-5 text-white shadow-lg">
        <p className="text-sm font-semibold text-emerald-100">हाथ में नकद</p>
        <p className="mt-1 text-4xl font-black">
          {formatRupees(cashInHandPaise)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-emerald-100">कुल बचत</p>
            <p className="text-xl font-bold">{formatRupees(groupSavingsPaise)}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-emerald-100">बाकी कर्ज़</p>
            <p className="text-xl font-bold">
              {formatRupees(groupLoanOutstandingPaise)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <HomeTile href="/samooh/entry?type=savings" color="bg-emerald-600" emoji="💰" label="जमा" />
        <HomeTile href="/samooh/entry?type=loan_out" color="bg-orange-600" emoji="🤲" label="कर्ज़" />
        <HomeTile
          href="/samooh/group"
          color="bg-sky-700"
          emoji="👥"
          label={`सदस्य (${members.length})`}
        />
        <HomeTile
          href="/samooh/history"
          color="bg-stone-700"
          emoji="📒"
          label={pending ? `खाता (${pending} बाकी)` : "खाता"}
        />
      </section>
    </div>
  );
}

function HomeTile({ href, color, emoji, label }) {
  return (
    <Link
      to={href}
      className={`${color} flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl text-white shadow-md`}
    >
      <span className="text-4xl">{emoji}</span>
      <span className="text-xl font-black">{label}</span>
    </Link>
  );
}
