import { Outlet, useLocation } from "react-router-dom";
import { NewsNav } from "./NewsNav.jsx";
import { NewsOnboarding } from "./NewsOnboarding.jsx";
import { NewsProvider, useNews } from "./NewsProvider.jsx";

export function NewsShell() {
  return (
    <NewsProvider>
      <NewsInner />
    </NewsProvider>
  );
}

function NewsInner() {
  const { loading, user, alert, clearAlert, lang, setLang, t } = useNews();
  const location = useLocation();
  const inThread = /\/news\/chat\/(dm|group)\//.test(location.pathname);

  if (loading) {
    return (
      <div className="app-bg flex min-h-dvh items-center justify-center text-xl font-bold text-[var(--forest-deep)]">
        {t("loading")}
      </div>
    );
  }

  if (!lang) {
    return (
      <div className="app-bg mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
        <div className="glass rise rounded-[2rem] px-6 py-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--forest)] text-4xl text-white shadow-lg">
            🌾
          </div>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-[var(--ink)]">Village</h1>
          <p className="mt-2 text-base font-medium text-stone-500">भाषा चुनें / Choose language</p>
          <div className="mt-8 grid gap-3">
            <button type="button" onClick={() => setLang("hi")} className="btn-primary min-h-16 rounded-2xl text-xl font-extrabold">
              हिंदी
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className="min-h-16 rounded-2xl bg-white text-xl font-extrabold text-[var(--forest-deep)] shadow-sm"
            >
              English
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-bg min-h-dvh">
        <NewsOnboarding />
      </div>
    );
  }

  return (
    <div className={`app-bg ${inThread ? "" : "pb-28"}`}>
      {alert && !inThread ? (
        <button
          type="button"
          onClick={clearAlert}
          className="w-full bg-[linear-gradient(90deg,#0e5c54,#1a7a70)] px-4 py-3 text-left text-sm font-semibold text-white"
        >
          🔔 {alert.villageName}: {alert.authorName} — {alert.preview || t("newAlert")}
        </button>
      ) : null}
      <main className={inThread ? "" : "mx-auto max-w-lg px-4 py-5"}>
        <Outlet />
      </main>
      {inThread ? null : <NewsNav />}
    </div>
  );
}
