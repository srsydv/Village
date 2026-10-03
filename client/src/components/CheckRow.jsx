export function CheckRow({ checked, label, detail, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="flex min-h-11 w-full items-start gap-3 py-1.5 text-left">
      <span
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[0.7rem] ${
          checked
            ? "border-[var(--gold)] bg-[var(--gold)] text-[#1a140c]"
            : "border-[rgba(232,201,154,0.35)] text-transparent"
        }`}
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm leading-snug ${checked ? "text-[var(--muted)]" : "text-[#f0e8da]"}`}>{label}</span>
        {detail ? <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted)]">{detail}</span> : null}
      </span>
    </button>
  );
}
