import { NavLink, useLocation } from "react-router-dom";
import { useNews } from "./NewsProvider.jsx";

export function NewsNav() {
  const location = useLocation();
  const { t } = useNews();
  const tabs = [
    { href: "/news", emoji: "🏠", label: t("navHome") },
    { href: "/news/official", emoji: "🏛️", label: t("navOfficial") },
    { href: "/news/compose", emoji: "✦", label: t("navCompose") },
    { href: "/news/chat", emoji: "💬", label: t("navChat") },
  ];
  return (
    <nav className="dock glass fixed z-40 px-1 py-1">
      <ul className="mx-auto grid grid-cols-4">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <NavLink
              to={tab.href}
              end={tab.href === "/news"}
              className={({ isActive }) => {
                const chatOpen = tab.href === "/news/chat" && location.pathname.startsWith("/news/chat");
                const on = isActive || chatOpen;
                return `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold ${
                  on ? "bg-[var(--forest)] text-white shadow-md" : "text-stone-500"
                }`;
              }}
            >
              <span className="text-lg leading-none" aria-hidden>
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
