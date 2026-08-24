import { useSeva } from "./SevaProvider.jsx";

export function SevaOfflineBanner() {
  const { online, pending, sync } = useSeva();
  if (online && pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void sync()}
      className={`w-full px-4 py-2 text-center text-sm font-semibold ${
        online ? "bg-sky-100 text-sky-950" : "bg-stone-800 text-sky-50"
      }`}
    >
      {online
        ? `${pending} चीज़ें सिंक बाकी — दबाइए`
        : "ऑफलाइन — माँग फोन पर सेव होगी, SMS से भी भेज सकते हैं"}
    </button>
  );
}

export function SevaSyncBadge({ className = "" }) {
  const { pending } = useSeva();
  if (pending === 0) return null;
  return (
    <span
      className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-sky-500 px-2 text-sm font-bold text-white ${className}`}
    >
      {pending}
    </span>
  );
}
