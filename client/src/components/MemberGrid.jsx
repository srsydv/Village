import { AVATARS, formatRupees } from "../lib/types.js";

export function MemberGrid({ balances, onSelect, selectedId }) {
  if (balances.length === 0) {
    return (
      <p className="rounded-2xl bg-stone-100 px-4 py-8 text-center text-lg text-stone-600">
        अभी कोई सदस्य नहीं। समूह में जोड़ें।
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {balances.map((b) => {
        const avatar = AVATARS.find((a) => a.key === b.avatarKey);
        const selected = selectedId === b.memberId;
        const inner = (
          <>
            <span className="text-4xl" aria-hidden>
              {avatar?.emoji ?? "👤"}
            </span>
            <span className="mt-2 text-lg font-bold leading-tight">
              {b.displayName}
            </span>
            <span className="mt-1 text-sm font-semibold text-emerald-800">
              {formatRupees(b.savingsPaise)}
            </span>
            {b.loanOutstandingPaise > 0 ? (
              <span className="text-xs font-semibold text-orange-800">
                कर्ज़ {formatRupees(b.loanOutstandingPaise)}
              </span>
            ) : null}
          </>
        );

        return (
          <li key={b.memberId}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(b.memberId)}
                className={`flex min-h-36 w-full flex-col items-center justify-center rounded-3xl border-4 p-3 ${
                  selected
                    ? "border-emerald-600 bg-emerald-50"
                    : "border-transparent bg-white shadow-sm"
                }`}
              >
                {inner}
              </button>
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-3xl bg-white p-3 shadow-sm">
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
