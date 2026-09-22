export function ConfirmDialog({ open, title, body, confirmLabel = "Confirm", danger = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end justify-center px-4 pb-[calc(5.8rem+env(safe-area-inset-bottom))]">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onCancel} />
      <div className="card relative w-full rounded-[1.5rem] p-5">
        <h2 className="serif text-2xl font-semibold">{title}</h2>
        {body ? <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{body}</p> : null}
        <button
          type="button"
          className={
            danger
              ? "mt-5 w-full rounded-2xl border border-[var(--rose)] py-3 text-sm font-semibold text-[var(--rose)]"
              : "btn-gold mt-5 w-full rounded-2xl py-3 text-sm font-semibold"
          }
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button type="button" className="mt-2 w-full py-2.5 text-sm text-[var(--muted)]" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
