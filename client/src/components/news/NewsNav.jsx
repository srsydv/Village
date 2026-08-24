import { NavLink, useLocation } from "react-router-dom";

const tabs = [
  { href: "/news", emoji: "🏠", label: "घर" },
  { href: "/news/official", emoji: "🏛️", label: "सरकारी" },
  { href: "/news/compose", emoji: "📸", label: "लिखें" },
  { href: "/news/chat", emoji: "💬", label: "बात" },
];

export function NewsNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-teal-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <NavLink
              to={tab.href}
              end={tab.href === "/news"}
              className={({ isActive }) => {
                const chatOpen = tab.href === "/news/chat" && location.pathname.startsWith("/news/chat");
                return `flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${
                  isActive || chatOpen ? "bg-teal-50 text-teal-900" : "text-stone-500"
                }`;
              }}
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
