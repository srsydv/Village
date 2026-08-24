import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { joinChatRoom, onChatMessage } from "../../lib/news/socket.js";
import { useNews } from "./NewsProvider.jsx";

function previewOf(msg) {
  if (!msg) return "अभी कोई बात नहीं";
  if (msg.text) return msg.text;
  if (msg.audioUrl) return "🎤 आवाज़";
  return "संदेश";
}

function timeOf(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" });
}

export function ChatInbox() {
  const { token, user, socketLive } = useNews();
  const [tab, setTab] = useState("chats");
  const [threads, setThreads] = useState([]);
  const [villagers, setVillagers] = useState([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState([]);

  async function load() {
    const res = await fetch("/api/news/chat/inbox", { headers: authHeaders(token) });
    const data = await res.json();
    if (res.ok) {
      setThreads(data.threads || []);
      setVillagers(data.villagers || []);
    }
  }

  useEffect(() => {
    void load();
    return onChatMessage(() => {
      void load();
    });
  }, [token]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/news/chat/search?q=${encodeURIComponent(q)}`, {
          headers: authHeaders(token),
        });
        const data = await res.json();
        if (res.ok) setHits(data.users || []);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, token]);

  const groups = threads.filter((t) => t.kind === "group");
  const dms = threads.filter((t) => t.kind === "dm");
  const list = tab === "groups" ? groups : tab === "people" ? dms : threads;
  const searchingUsers = query.trim().length >= 2;

  async function createGroup() {
    if (!groupName.trim()) return;
    const res = await fetch("/api/news/chat/groups", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName.trim(), memberIds: picked }),
    });
    if (res.ok) {
      setShowCreate(false);
      setGroupName("");
      setPicked([]);
      await load();
    }
  }

  return (
    <div className="-mx-4 -mt-5 min-h-[70vh] bg-[#efeae2]">
      <header className="bg-teal-800 px-4 pb-3 pt-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">बात</h1>
          <span className={`text-xs font-semibold ${socketLive ? "text-emerald-200" : "text-amber-200"}`}>
            {socketLive ? "● लाइव" : "○ जोड़ रहे हैं"}
          </span>
        </div>
        <p className="mt-1 text-sm text-teal-100">{user.villageName}</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="नाम या ईमेल से खोजें"
          className="mt-3 min-h-11 w-full rounded-full bg-white px-4 text-sm font-semibold text-stone-800 placeholder:text-stone-400"
        />
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-teal-900/50 p-1">
          {[
            ["chats", "चैट"],
            ["groups", "समूह"],
            ["people", "लोग"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-10 rounded-lg text-sm font-bold ${
                tab === id ? "bg-white text-teal-900" : "text-teal-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {searchingUsers ? (
        <ul className="mt-2">
          {searching ? (
            <li className="px-4 py-6 text-center text-sm text-stone-500">खोज रहे हैं…</li>
          ) : null}
          {!searching && hits.length === 0 ? (
            <li className="px-4 py-8 text-center text-stone-500">कोई यूज़र नहीं मिला</li>
          ) : null}
          {hits.map((p) => (
            <li key={p._id}>
              <Link
                to={`/news/chat/dm/${p._id}`}
                className="flex items-center gap-3 border-b border-stone-200/70 bg-white px-4 py-3"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-700 text-lg font-black text-white">
                  {(p.displayName || "?").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-stone-900">{p.displayName}</span>
                  <span className="block truncate text-sm text-stone-500">
                    {p.email || "ईमेल नहीं"}
                    {p.villageName ? ` · ${p.villageName}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
      {tab === "groups" ? (
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="mx-4 mt-3 min-h-12 w-[calc(100%-2rem)] rounded-2xl bg-teal-800 font-bold text-white"
        >
          + नया समूह
        </button>
      ) : null}

      {showCreate && tab === "groups" ? (
        <div className="mx-4 mt-3 space-y-2 rounded-2xl bg-white p-3">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="समूह का नाम"
            className="min-h-12 w-full rounded-xl border-2 border-stone-200 px-3"
          />
          <p className="text-sm font-semibold text-stone-600">सदस्य चुनें</p>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {villagers.map((v) => (
              <label key={v._id} className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={picked.includes(v._id)}
                  onChange={(e) =>
                    setPicked((ids) => (e.target.checked ? [...ids, v._id] : ids.filter((id) => id !== v._id)))
                  }
                />
                {v.displayName}
              </label>
            ))}
            {villagers.length === 0 ? <p className="text-sm text-stone-500">गाँव में और कोई नहीं</p> : null}
          </div>
          <button type="button" onClick={() => void createGroup()} className="min-h-11 w-full rounded-xl bg-teal-800 font-bold text-white">
            समूह बनाएं
          </button>
        </div>
      ) : null}

      <ul className="mt-2">
        {list.map((t) => {
          const href =
            t.kind === "dm"
              ? `/news/chat/dm/${t.peerId || t.id}`
              : t.id === "village"
                ? "/news/chat/group/village"
                : `/news/chat/group/${t.id}`;
          return (
            <li key={`${t.kind}-${t.id}`}>
              <Link to={href} className="flex items-center gap-3 border-b border-stone-200/70 bg-white px-4 py-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-700 text-lg font-black text-white">
                  {t.kind === "group" ? "👥" : (t.title || "?").slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-black text-stone-900">{t.title}</span>
                    <span className="shrink-0 text-xs text-stone-400">{timeOf(t.last?.createdAt)}</span>
                  </span>
                  <span className="block truncate text-sm text-stone-500">{previewOf(t.last)}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {list.length === 0 ? (
          <li className="px-4 py-10 text-center text-stone-500">यहाँ अभी कोई चैट नहीं</li>
        ) : null}
      </ul>
        </>
      )}
    </div>
  );
}

export function ChatThread() {
  const { token, user, socketLive } = useNews();
  const navigate = useNavigate();
  const { peerId, groupId } = useParams();
  const [search] = useSearchParams();
  const [title, setTitle] = useState(search.get("title") || "बात");
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [rec, setRec] = useState(null);
  const bottomRef = useRef(null);

  const query = useMemo(() => {
    if (peerId) return `peerId=${encodeURIComponent(peerId)}`;
    if (groupId) return `groupId=${encodeURIComponent(groupId)}`;
    return "";
  }, [peerId, groupId]);

  async function load() {
    const res = await fetch(`/api/news/chat?${query}`, { headers: authHeaders(token) });
    const data = await res.json();
    if (res.ok) {
      setRoomId(data.roomId);
      setMessages(data.messages || []);
      if (data.title) setTitle(data.title);
      if (data.roomId) joinChatRoom(data.roomId);
    }
  }

  useEffect(() => {
    void load();
  }, [token, query]);

  useEffect(() => {
    return onChatMessage((payload) => {
      if (!payload?.roomId) {
        void load();
        return;
      }
      if (payload.roomId === roomId) {
        setMessages((prev) => (prev.some((m) => m._id === payload._id) ? prev : [...prev, payload]));
      }
    });
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(audioFile) {
    const body = new FormData();
    if (text.trim()) body.append("text", text.trim());
    if (peerId) body.append("peerId", peerId);
    if (groupId) body.append("groupId", groupId);
    if (audioFile) body.append("audio", audioFile);
    if (!text.trim() && !audioFile) return;
    const res = await fetch("/api/news/chat", {
      method: "POST",
      headers: authHeaders(token),
      body,
    });
    if (res.ok) {
      const data = await res.json();
      setText("");
      if (data.message) {
        setMessages((prev) => (prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]));
      }
      if (data.roomId) {
        setRoomId(data.roomId);
        joinChatRoom(data.roomId);
      }
    }
  }

  async function startVoice() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const file = new File([blob], "voice.webm", { type: blob.type });
      setRec(null);
      await send(file);
    };
    recorder.start();
    setRec(recorder);
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto flex h-dvh max-w-lg flex-col bg-[#efeae2]">
      <header className="flex items-center gap-2 bg-teal-800 px-3 py-3 text-white">
        <button type="button" onClick={() => navigate("/news/chat")} className="min-h-10 px-2 text-xl">
          ←
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 font-black">
          {peerId ? (title || "?").slice(0, 1) : "👥"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black">{title}</p>
          <p className="text-xs text-teal-100">{socketLive ? "लाइव" : "कनेक्ट हो रहा है…"}</p>
        </div>
      </header>

      <ul className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.map((m) => {
          const mine = m.fromId === user._id;
          return (
            <li key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
                  mine ? "rounded-br-sm bg-[#d9fdd3]" : "rounded-bl-sm bg-white"
                }`}
              >
                {!mine ? <p className="text-xs font-bold text-teal-800">{m.fromName}</p> : null}
                {m.text ? <p className="whitespace-pre-wrap text-[15px] leading-snug">{m.text}</p> : null}
                {m.audioUrl ? <audio src={m.audioUrl} controls className="mt-1 w-full" /> : null}
                <p className="mt-0.5 text-right text-[10px] text-stone-500">{timeOf(m.createdAt)}</p>
              </div>
            </li>
          );
        })}
        {messages.length === 0 ? (
          <li className="py-16 text-center text-sm text-stone-500">यहाँ बात शुरू करें</li>
        ) : null}
        <li ref={bottomRef} />
      </ul>

      <form
        className="flex gap-2 bg-[#f0f2f5] px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="संदेश लिखें"
          className="min-h-12 flex-1 rounded-full bg-white px-4"
        />
        {rec ? (
          <button type="button" onClick={() => rec.stop()} className="min-h-12 rounded-full bg-red-700 px-4 font-bold text-white">
            रोकें
          </button>
        ) : (
          <button type="button" onClick={() => void startVoice()} className="min-h-12 rounded-full bg-stone-700 px-3 text-white">
            🎤
          </button>
        )}
        <button type="submit" className="min-h-12 rounded-full bg-teal-800 px-4 font-black text-white">
          ➤
        </button>
      </form>
    </div>
  );
}

export function ChatScreen() {
  return <ChatInbox />;
}
