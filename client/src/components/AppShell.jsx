import { Outlet } from "react-router-dom";
import { AuthGate } from "./AuthGate.jsx";
import { BottomNav } from "./BottomNav.jsx";
import { GroupProvider, useGroup } from "./GroupProvider.jsx";
import { OfflineBanner } from "./OfflineBanner.jsx";

export function AppShell() {
  return (
    <GroupProvider>
      <ShellInner />
    </GroupProvider>
  );
}

function ShellInner() {
  const { session, loading } = useGroup();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f6f1e7] text-xl font-bold text-emerald-900">
        समूह लोड हो रहा है…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-dvh bg-[#f6f1e7]">
        <AuthGate />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f6f1e7] pb-24">
      <OfflineBanner />
      <main className="mx-auto max-w-lg px-4 py-5">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
