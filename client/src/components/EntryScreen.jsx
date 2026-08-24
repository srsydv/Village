import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AmountKeypad } from "./AmountKeypad.jsx";
import { MemberGrid } from "./MemberGrid.jsx";
import { useComputedBalances, useGroup } from "./GroupProvider.jsx";
import { queueTransaction } from "../lib/offline/sync.js";
import { rupeesToPaise } from "../lib/types.js";
import { confirmationPhrase, speakHindi } from "../lib/tts.js";

const TYPES = [
  { key: "savings", label: "जमा", color: "bg-emerald-600" },
  { key: "loan_out", label: "कर्ज़ दिया", color: "bg-orange-600" },
  { key: "loan_repay", label: "कर्ज़ चुकाया", color: "bg-sky-700" },
];

export function EntryScreen() {
  const [search] = useSearchParams();
  const initial = search.get("type") || "savings";
  const { session, refreshLocal, sync } = useGroup();
  const { balances } = useComputedBalances();
  const [type, setType] = useState(
    TYPES.some((t) => t.key === initial) ? initial : "savings",
  );
  const [memberId, setMemberId] = useState(undefined);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const selected = useMemo(
    () => balances.find((b) => b.memberId === memberId),
    [balances, memberId],
  );

  async function save() {
    if (!session || !memberId || !selected) {
      setStatus("पहले सदस्य चुनें");
      return;
    }
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setStatus("राशि डालें");
      return;
    }

    await queueTransaction({
      groupId: session.groupId,
      memberId,
      type,
      amountPaise: rupeesToPaise(rupees),
    });
    await refreshLocal();
    speakHindi(
      confirmationPhrase({
        memberName: selected.displayName,
        amountRupees: rupees,
        type,
      }),
    );
    setAmount("");
    setStatus("सेव हो गया");
    void sync();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-emerald-950">एंट्री</h1>

      <div className="grid grid-cols-3 gap-2">
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`min-h-14 rounded-2xl px-1 text-sm font-black ${
              type === t.key ? `${t.color} text-white` : "bg-stone-200 text-stone-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
        <p className="text-sm font-semibold text-stone-500">राशि (₹)</p>
        <p className="text-5xl font-black text-emerald-950">{amount || "0"}</p>
      </div>

      <AmountKeypad value={amount} onChange={setAmount} />

      <MemberGrid
        balances={balances}
        selectedId={memberId}
        onSelect={setMemberId}
      />

      {status ? (
        <p className="text-center font-semibold text-emerald-800">{status}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void save()}
        className="min-h-16 w-full rounded-2xl bg-emerald-700 text-xl font-black text-white"
      >
        सहेजें और सुनें
      </button>
    </div>
  );
}
