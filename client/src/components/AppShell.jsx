import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "./BottomNav.jsx";

export function AppShell() {
  const { pathname } = useLocation();
  const adminView = pathname.startsWith("/admin");

  return (
    <div className="relative min-h-dvh">
      <Outlet />
      {adminView ? null : <BottomNav />}
    </div>
  );
}
