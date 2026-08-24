import { useGroup } from "./GroupProvider.jsx";

export function OfflineBanner() {
  const { online, pending, sync } = useGroup();

  if (online && pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void sync()}
      className={`w-full px-4 py-2 text-center text-sm font-semibold ${
        online ? "bg-amber-100 text-amber-950" : "bg-stone-800 text-amber-50"
      }`}
    >
      {online
        ? `${pending} एंट्री सिंक बाकी — दबाइए`
        : "ऑफलाइन — एंट्री फोन पर सेव होंगी"}
    </button>
  );
}

export function SyncBadge({ className = "" }) {
  const { pending } = useGroup();
  if (pending === 0) return null;
  return (
    <span
      className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-amber-500 px-2 text-sm font-bold text-white ${className}`}
    >
      {pending}
    </span>
  );
}
