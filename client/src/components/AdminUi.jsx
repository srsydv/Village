import { RichText } from "../lib/richtext.jsx";

export function AdminTabs({ tabs, value, onChange }) {
  const cols = tabs.length === 2 ? "grid-cols-2" : tabs.length === 3 ? "grid-cols-3" : "grid-cols-4";
  return (
    <div className={`mt-5 grid ${cols} gap-1 rounded-2xl border border-[var(--line)] bg-[rgba(10,14,24,0.55)] p-1`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`rounded-xl py-2.5 text-[0.78rem] font-semibold ${
            value === tab.id ? "btn-gold" : "text-[var(--muted)]"
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.count != null ? ` · ${tab.count}` : ""}
        </button>
      ))}
    </div>
  );
}

export function AdminAvatar({ name, email, picture, size = "md" }) {
  const dim = size === "lg" ? "h-14 w-14 text-lg" : "h-11 w-11 text-sm";
  const letter = (name || email || "U").slice(0, 1).toUpperCase();
  if (picture) {
    return <img src={picture} alt="" className={`${dim} rounded-full object-cover`} referrerPolicy="no-referrer" />;
  }
  return (
    <div
      className={`grid ${dim} place-items-center rounded-full border border-[var(--line)] font-semibold text-[var(--gold-bright)]`}
    >
      {letter}
    </div>
  );
}

export function ToneDot({ tone }) {
  const color =
    tone === "ask" ? "bg-[var(--gold-bright)]" : tone === "plan" ? "bg-[var(--ok)]" : tone === "places" ? "bg-[#8bb4ff]" : "bg-[var(--muted)]";
  return <span className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

export function EmptyNote({ children }) {
  return (
    <div className="card mt-4 rounded-[1.3rem] px-4 py-8 text-center">
      <p className="text-sm text-[var(--muted)]">{children}</p>
    </div>
  );
}

export function NameList({ title, items }) {
  const list = (items || []).filter((item) => item?.name || typeof item === "string");
  if (!list.length) return null;
  return (
    <div>
      <p className="text-[0.68rem] tracking-wide text-[var(--gold)] uppercase">{title}</p>
      <ul className="mt-1.5 space-y-1">
        {list.map((item, i) => (
          <li key={`${title}-${item.name || item}-${i}`} className="text-sm text-[#d8d2c6]">
            {item.name || item}
            {item.area ? <span className="text-[var(--muted)]"> · {item.area}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminChatMessages({ messages }) {
  return (
    <div className="space-y-3">
      {(messages || []).map((message, i) => (
        <article
          key={`${message.role}-${i}`}
          className={
            message.role === "user"
              ? "ml-8 rounded-[1.15rem] bg-[linear-gradient(180deg,#e8c99a,#c9a36a)] px-4 py-3 text-sm text-[#1a140c]"
              : "card prose-safar mr-6 rounded-[1.15rem] px-4 py-3 text-sm"
          }
        >
          <p
            className={`mb-1.5 text-[0.62rem] tracking-wide uppercase ${
              message.role === "user" ? "text-[#5a4630]" : "text-[var(--gold)]"
            }`}
          >
            {message.role === "assistant" ? "Safar" : "They asked"}
          </p>
          {message.role === "assistant" ? (
            <RichText text={message.content || "—"} />
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content || "—"}</p>
          )}
        </article>
      ))}
    </div>
  );
}
