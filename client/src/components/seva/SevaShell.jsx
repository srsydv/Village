import { Outlet } from "react-router-dom";
import { SevaAuthGate } from "./SevaAuthGate.jsx";
import { SevaNav } from "./SevaNav.jsx";
import { SevaOfflineBanner } from "./SevaOfflineBanner.jsx";
import { SevaProvider, useSeva } from "./SevaProvider.jsx";

export function SevaShell() {
  return (
    <SevaProvider>
      <SevaInner />
    </SevaProvider>
  );
}

function SevaInner() {
  const { session, loading } = useSeva();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f6f1e7] text-xl font-bold text-sky-900">
        ग्रामसेवा लोड हो रही है…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-[#f6f1e7]">
        <SevaAuthGate />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f6f1e7] pb-24">
      <SevaOfflineBanner />
      <main className="mx-auto max-w-lg px-4 py-5">
        <Outlet />
      </main>
      <SevaNav />
    </div>
  );
}
