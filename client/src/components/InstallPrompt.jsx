import { useEffect, useState } from "react";

export function InstallPrompt() {
  const [event, setEvent] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!event || hidden) return null;

  return (
    <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-2xl bg-emerald-800 px-4 py-3 text-white">
      <p className="text-sm font-semibold">ऐप होम स्क्रीन पर लगाएं</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-emerald-900"
          onClick={async () => {
            await event.prompt();
            setHidden(true);
          }}
        >
          इंस्टॉल
        </button>
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm font-semibold text-emerald-100"
          onClick={() => setHidden(true)}
        >
          बाद में
        </button>
      </div>
    </div>
  );
}
