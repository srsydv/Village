import { useEffect, useState } from "react";
import { useNews } from "./news/NewsProvider.jsx";

export function InstallPrompt() {
  const { t } = useNews();
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
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-[var(--forest)] px-4 py-3 text-white shadow-lg">
      <p className="text-sm font-semibold">{t("install")}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-[var(--forest-deep)]"
          onClick={async () => {
            await event.prompt();
            setHidden(true);
          }}
        >
          {t("installBtn")}
        </button>
        <button
          type="button"
          className="rounded-xl px-3 py-2 text-sm font-semibold text-white/80"
          onClick={() => setHidden(true)}
        >
          {t("later")}
        </button>
      </div>
    </div>
  );
}
