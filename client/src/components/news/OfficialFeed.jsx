import { useEffect, useState } from "react";
import { authHeaders } from "../../lib/news/session.js";
import { useNews } from "./NewsProvider.jsx";

export function OfficialFeed() {
  const { token, user } = useNews();
  const [notices, setNotices] = useState([]);
  const [sources, setSources] = useState([]);
  const [reader, setReader] = useState(null);
  const [frameUrl, setFrameUrl] = useState("");

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
    setFrameUrl(`/api/news/reader/frame?url=${encodeURIComponent(src.url)}`);
    const res = await fetch(`/api/news/reader?url=${encodeURIComponent(src.url)}`);
    const data = await res.json();
    if (res.ok) setReader({ ...data, title: data.title || src.title });
    else setReader({ title: src.title, excerpt: data.error || "", url: src.url });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-teal-950">सरकारी खबर</h1>
      <p className="text-base text-stone-600">
        पिन {user.pincode} · {user.district}, {user.state}. साइट ऐप के अंदर खुलती है।
      </p>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sources.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => void openSource(s)}
            className="shrink-0 rounded-2xl bg-teal-800 px-3 py-2 text-sm font-bold text-white"
          >
            {s.title}
          </button>
        ))}
      </div>

      {frameUrl ? (
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <p className="px-3 py-2 text-sm font-bold text-teal-950">
            {reader?.title || "सरकारी पन्ना"}
          </p>
          {reader?.excerpt ? (
            <p className="px-3 pb-2 text-sm text-stone-600">{reader.excerpt}</p>
          ) : null}
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
          <li key={n._id} className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-xs font-bold text-teal-800">{n.source}</p>
            <h2 className="text-lg font-black">{n.title}</h2>
            <p className="mt-1 text-stone-700">{n.body}</p>
            {n.url ? (
              <button
                type="button"
                className="mt-3 min-h-11 rounded-xl bg-teal-800 px-3 text-sm font-bold text-white"
                onClick={() =>
                  void openSource({ title: n.title, url: n.url, id: n._id })
                }
              >
                ऐप में पढ़ें
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
