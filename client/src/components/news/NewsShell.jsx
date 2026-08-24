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
  const { loading, user, alert, clearAlert } = useNews();
  const location = useLocation();
  const inThread = /\/news\/chat\/(dm|group)\//.test(location.pathname);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f6f1e7] text-xl font-bold text-teal-900">
        समाचार लोड हो रहा है…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-dvh bg-[#f6f1e7]">
        <NewsOnboarding />
      </div>
    );
  }

  return (
    <div className={`min-h-dvh bg-[#f6f1e7] ${inThread ? "" : "pb-24"}`}>
      {alert && !inThread ? (
        <button
          type="button"
          onClick={clearAlert}
          className="w-full bg-teal-800 px-4 py-3 text-left text-sm font-semibold text-white"
        >
          🔔 {alert.villageName}: {alert.authorName} — {alert.preview}
        </button>
      ) : null}
      <main className={inThread ? "" : "mx-auto max-w-lg px-4 py-5"}>
        <Outlet />
      </main>
      {inThread ? null : <NewsNav />}
    </div>
  );
}
