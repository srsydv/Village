import { NavLink } from "react-router-dom";

const tabs = [
  { href: "/", emoji: "🏠", label: "घर" },
  { href: "/group", emoji: "👥", label: "समूह" },
  { href: "/entry", emoji: "➕", label: "जमा" },
  { href: "/history", emoji: "📒", label: "खाता" },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-amber-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <NavLink
              to={tab.href}
              end={tab.href === "/"}
              className={({ isActive }) =>
                `flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${
                  isActive ? "bg-amber-50 text-amber-900" : "text-stone-500"
                }`
              }
            >
              <span className="text-2xl" aria-hidden>
                {tab.emoji}
              </span>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
