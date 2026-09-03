import { NavLink } from "react-router-dom";

const ITEMS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/explore", label: "Explore", icon: CompassIcon },
  { to: "/plan", label: "Plan", icon: PlanIcon },
  { to: "/trips", label: "Trips", icon: BagIcon },
  { to: "/ask", label: "Ask", icon: SparkIcon },
];

export function BottomNav() {
  return (
    <nav className="dock glass pointer-events-auto fixed z-40 mx-auto flex max-w-[404px] items-center justify-around px-1 py-2">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `flex min-w-[3.4rem] flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[0.62rem] font-medium tracking-wide ${
              isActive ? "text-[var(--gold-bright)]" : "text-[var(--muted)]"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <item.icon active={isActive} />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function HomeIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={active ? "#E8C99A" : "#8B93A7"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompassIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.2" stroke={active ? "#E8C99A" : "#8B93A7"} strokeWidth="1.6" />
      <path
        d="m14.8 9.2-1.3 5.3-5.3 1.3 1.3-5.3 5.3-1.3Z"
        stroke={active ? "#E8C99A" : "#8B93A7"}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlanIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="5"
        y="4.5"
        width="14"
        height="15"
        rx="2.2"
        stroke={active ? "#E8C99A" : "#8B93A7"}
        strokeWidth="1.6"
      />
      <path d="M8 3.8v2.2M16 3.8v2.2M5.8 9h12.4" stroke={active ? "#E8C99A" : "#8B93A7"} strokeWidth="1.6" />
    </svg>
  );
}

function BagIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.2 8.2h11.6l-.7 10.2a2 2 0 0 1-2 1.8H8.9a2 2 0 0 1-2-1.8L6.2 8.2Z"
        stroke={active ? "#E8C99A" : "#8B93A7"}
        strokeWidth="1.6"
      />
      <path
        d="M9 8.1V6.6a3 3 0 0 1 6 0v1.5"
        stroke={active ? "#E8C99A" : "#8B93A7"}
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SparkIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5 13.7 9l5.8 1.7-5.8 1.7L12 18.1l-1.7-5.7L4.5 10.7 10.3 9 12 3.5Z"
        stroke={active ? "#E8C99A" : "#8B93A7"}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
