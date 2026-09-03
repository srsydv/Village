import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav.jsx";

export function AppShell() {
  return (
    <div className="relative min-h-dvh">
      <Outlet />
      <BottomNav />
    </div>
  );
}
