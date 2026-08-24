import { useNews } from "./NewsProvider.jsx";

export function LanguageToggle({ compact = false }) {
  const { lang, setLang, t } = useNews();
  return (
    <div className={`grid grid-cols-2 gap-1 rounded-full bg-black/5 p-1 ${compact ? "" : "mb-5"}`}>
      <button
        type="button"
        onClick={() => setLang("hi")}
        className={`${compact ? "min-h-8 text-xs" : "min-h-11 text-sm"} rounded-full font-bold ${
          lang === "hi" ? "bg-white text-[var(--forest-deep)] shadow-sm" : "text-stone-500"
        }`}
      >
        {t("hindi")}
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`${compact ? "min-h-8 text-xs" : "min-h-11 text-sm"} rounded-full font-bold ${
          lang === "en" ? "bg-white text-[var(--forest-deep)] shadow-sm" : "text-stone-500"
        }`}
      >
        {t("english")}
      </button>
    </div>
  );
}
