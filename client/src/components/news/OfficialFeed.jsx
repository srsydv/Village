import { useEffect, useState } from "react";
import { authHeaders } from "../../lib/news/session.js";
import { useNews } from "./NewsProvider.jsx";

function sourceTitle(src, t, user) {
  if (src.id === "district") return `${user.district} ${t("srcDistrict")}`;
  if (src.id === "state") return `${user.state} ${t("srcState")}`;
  if (src.id === "india") return t("srcIndia");
  if (src.id === "pib") return t("srcPib");
  if (src.id === "pin") return `${t("pinLabel")} ${user.pincode} ${t("srcPin")}`;
  return src.title;
}

export function OfficialFeed() {
  const { token, user, t } = useNews();
  const [notices, setNotices] = useState([]);
  const [sources, setSources] = useState([]);
  const [reader, setReader] = useState(null);
  const [frameUrl, setFrameUrl] = useState("");
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/news/official", { headers: authHeaders(token) });
      const data = await res.json();
      if (res.ok) {
        setNotices(data.notices || []);
        setSources(data.sources || []);
      }
    })();
  }, [token]);

  async function openSource(src) {
    setActiveId(src.id);
    setFrameUrl(`/api/news/reader/frame?url=${encodeURIComponent(src.url)}`);
    const res = await fetch(`/api/news/reader?url=${encodeURIComponent(src.url)}`);
    const data = await res.json();
    const title = sourceTitle(src, t, user);
    if (res.ok) setReader({ ...data, title: data.title || title });
    else setReader({ title, excerpt: data.error || "", url: src.url });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="kicker">OFFICIAL</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{t("officialTitle")}</h1>
        <p className="mt-1 text-base text-stone-500">
          {t("pinLabel")} {user.pincode} · {user.district}, {user.state}. {t("officialHint")}
        </p>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {sources.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => void openSource(s)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
              activeId === s.id ? "btn-primary" : "card text-[var(--forest-deep)]"
            }`}
          >
            {sourceTitle(s, t, user)}
          </button>
        ))}
      </div>

      {frameUrl ? (
        <div className="card overflow-hidden rounded-[1.75rem]">
          <p className="px-4 py-3 text-sm font-extrabold text-[var(--forest-deep)]">{reader?.title || t("officialPage")}</p>
          {reader?.excerpt ? <p className="px-4 pb-2 text-sm text-stone-500">{reader.excerpt}</p> : null}
          <iframe
            title="official-reader"
            src={frameUrl}
            className="h-[28rem] w-full border-0 bg-white"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      ) : null}

      <ul className="space-y-3">
        {notices.map((n) => (
          <li key={n._id} className="card rounded-[1.75rem] p-4">
            <p className="kicker">{n.source}</p>
            <h2 className="mt-2 text-lg font-extrabold text-[var(--ink)]">{n.title}</h2>
            <p className="mt-1 text-stone-600">{n.body}</p>
            {n.url ? (
              <button
                type="button"
                className="btn-primary mt-3 min-h-11 rounded-xl px-4 text-sm font-bold"
                onClick={() => void openSource({ title: n.title, url: n.url, id: n._id })}
              >
                {t("readInApp")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
