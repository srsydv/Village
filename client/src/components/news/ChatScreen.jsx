import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { joinChatRoom, onChatMessage } from "../../lib/news/socket.js";
import { Avatar } from "./Avatar.jsx";
import { useNews } from "./NewsProvider.jsx";

function previewOf(msg, t) {
  if (!msg) return t("noChatYet");
  if (msg.sharedPost) return t("sharedPost");
  if (msg.mediaType === "image" && msg.mediaUrl) return t("photoMessage");
  if (msg.text) return msg.text;
  if (msg.audioUrl) return t("voiceNote");
  return t("message");
}

function PersonRow({ person, action, actionLabel, disabled }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={person.displayName} src={person.avatarUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-stone-900">{person.displayName}</p>
        <p className="truncate text-xs text-stone-500">
          {person.email || ""}
          {person.villageName ? ` · ${person.villageName}` : ""}
        </p>
      </div>
      {action ? (
        <button
          type="button"
          disabled={disabled}
          onClick={action}
          className="min-h-9 rounded-full bg-[var(--forest)] px-3 text-xs font-bold text-white disabled:opacity-40"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function MemberPicker({ token, villagers, picked, setPicked, t, excludeIds = [] }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const blocked = new Set([...picked.map((p) => p._id), ...excludeIds]);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/news/chat/search?q=${encodeURIComponent(needle)}`, {
          headers: authHeaders(token),
        });
        const data = await res.json();
        if (res.ok) setHits(data.users || []);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q, token]);

  function add(person) {
    setPicked((prev) => (prev.some((p) => p._id === person._id) || blocked.has(person._id) ? prev : [...prev, person]));
    setQ("");
    setHits([]);
  }

  function remove(id) {
    setPicked((prev) => prev.filter((p) => p._id !== id));
  }

  const suggestions = villagers.filter((v) => !blocked.has(v._id)).slice(0, 8);

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-stone-600">{t("pickMembers")}</p>
      {picked.length ? (
        <div className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <button
              key={p._id}
              type="button"
              onClick={() => remove(p._id)}
              className="rounded-full bg-[var(--forest)] px-3 py-1 text-xs font-bold text-white"
            >
              {p.displayName} ×
            </button>
          ))}
        </div>
      ) : null}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchMembers")}
        className="input-field min-h-11"
      />
      {q.trim().length >= 2 ? (
        <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl bg-stone-50 p-2">
          {searching ? <p className="px-1 py-2 text-sm text-stone-500">{t("searching")}</p> : null}
          {!searching && hits.length === 0 ? <p className="px-1 py-2 text-sm text-stone-500">{t("noUser")}</p> : null}
          {hits.map((p) => (
            <PersonRow
              key={p._id}
              person={p}
              action={() => add(p)}
              actionLabel={blocked.has(p._id) ? t("added") : t("add")}
              disabled={blocked.has(p._id)}
            />
          ))}
        </div>
      ) : suggestions.length ? (
        <div className="max-h-44 space-y-2 overflow-y-auto">
          <p className="text-xs font-bold text-stone-400">{t("nearbyPeople")}</p>
          {suggestions.map((p) => (
            <PersonRow key={p._id} person={p} action={() => add(p)} actionLabel={t("add")} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-stone-500">{t("noVillagers")}</p>
      )}
    </div>
  );
}

function timeOf(iso, locale) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function ChatInbox() {
  const { token, user, socketLive, t, te, locale } = useNews();
  const navigate = useNavigate();
  const [tab, setTab] = useState("chats");
  const [threads, setThreads] = useState([]);
  const [villagers, setVillagers] = useState([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [picked, setPicked] = useState([]);
  const [groupError, setGroupError] = useState("");

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
  const searchingUsers = query.trim().length >= 2 && !showCreate;

  async function createGroup() {
    setGroupError("");
    if (!groupName.trim()) {
      setGroupError(t("groupName"));
      return;
    }
    if (!picked.length) {
      setGroupError(t("needMembers"));
      return;
    }
    const res = await fetch("/api/news/chat/groups", {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName.trim(), memberIds: picked.map((p) => p._id) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setGroupError(te(data.error) || t("needMembers"));
      return;
    }
    setShowCreate(false);
    setGroupName("");
    setPicked([]);
    if (data.group?._id) {
      navigate(`/news/chat/group/${data.group._id}`);
      return;
    }
    await load();
  }

  return (
    <div className="-mx-4 -mt-5 min-h-[70vh] chat-wallpaper">
      <header className="bg-[var(--forest)] px-4 pb-3 pt-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">{t("chat")}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
              socketLive ? "bg-white/15 text-emerald-100" : "bg-black/20 text-amber-100"
            }`}
          >
            {socketLive ? t("live") : t("connecting")}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/75">{user.villageName}</p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPeople")}
          className="mt-3 min-h-11 w-full rounded-full bg-white px-4 text-sm font-semibold text-stone-800 placeholder:text-stone-400"
        />
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-black/20 p-1">
          {[
            ["chats", t("tabChats")],
            ["groups", t("tabGroups")],
            ["people", t("tabPeople")],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`min-h-10 rounded-full text-sm font-bold ${
                tab === id ? "bg-white text-[var(--forest-deep)]" : "text-white/80"
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
            <li className="px-4 py-6 text-center text-sm text-stone-500">{t("searching")}</li>
          ) : null}
          {!searching && hits.length === 0 ? (
            <li className="px-4 py-8 text-center text-stone-500">{t("noUser")}</li>
          ) : null}
          {hits.map((p) => (
            <li key={p._id}>
              <Link
                to={`/news/chat/dm/${p._id}`}
                className="flex items-center gap-3 border-b border-stone-200/70 bg-white px-4 py-3"
              >
                <Avatar name={p.displayName} src={p.avatarUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-stone-900">{p.displayName}</span>
                  <span className="block truncate text-sm text-stone-500">
                    {p.email || t("noEmail")}
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
          onClick={() => {
            setShowCreate((v) => !v);
            setGroupError("");
          }}
          className="btn-primary mx-4 mt-3 min-h-12 w-[calc(100%-2rem)] rounded-2xl font-bold"
        >
          {t("newGroup")}
        </button>
      ) : null}

      {showCreate && tab === "groups" ? (
        <div className="mx-4 mt-3 space-y-3 rounded-2xl bg-white p-3 shadow-sm">
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={t("groupName")}
            className="input-field min-h-12"
          />
          <MemberPicker token={token} villagers={villagers} picked={picked} setPicked={setPicked} t={t} />
          {groupError ? <p className="text-sm font-semibold text-red-800">{groupError}</p> : null}
          <button type="button" onClick={() => void createGroup()} className="btn-primary min-h-11 w-full rounded-xl font-bold">
            {t("createGroup")}
          </button>
        </div>
      ) : null}

      <ul className="mt-2">
        {list.map((thread) => {
          const href =
            thread.kind === "dm"
              ? `/news/chat/dm/${thread.peerId || thread.id}`
              : thread.id === "village"
                ? "/news/chat/group/village"
                : `/news/chat/group/${thread.id}`;
          return (
            <li key={`${thread.kind}-${thread.id}`}>
              <Link to={href} className="flex items-center gap-3 border-b border-white/40 bg-white/80 px-4 py-3 backdrop-blur-sm">
                {thread.kind === "group" ? (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--forest)] text-lg text-white">
                    👥
                  </span>
                ) : (
                  <Avatar name={thread.title} src={thread.avatarUrl} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-black text-stone-900">{thread.title}</span>
                    <span className="shrink-0 text-xs text-stone-400">{timeOf(thread.last?.createdAt, locale)}</span>
                  </span>
                  <span className="block truncate text-sm text-stone-500">{previewOf(thread.last, t)}</span>
                </span>
              </Link>
            </li>
          );
        })}
        {list.length === 0 ? (
          <li className="px-4 py-10 text-center text-stone-500">{t("noChats")}</li>
        ) : null}
      </ul>
        </>
      )}
    </div>
  );
}

export function ChatThread() {
  const { token, user, socketLive, t, te, locale, lang } = useNews();
  const navigate = useNavigate();
  const { peerId, groupId } = useParams();
  const [search] = useSearchParams();
  const [title, setTitle] = useState(search.get("title") || t("chat"));
  const [roomId, setRoomId] = useState("");
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState([]);
  const [addError, setAddError] = useState("");
  const [text, setText] = useState("");
  const [rec, setRec] = useState(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const imageInputRef = useRef(null);
  const bottomRef = useRef(null);
  const customGroup = Boolean(groupId && groupId !== "village");
  const villageGroup = groupId === "village";

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
      setMembers(data.members || []);
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
    if (imageFile) body.append("image", imageFile);
    if (!text.trim() && !audioFile && !imageFile) return;
    setChatError("");
    const res = await fetch("/api/news/chat", {
      method: "POST",
      headers: authHeaders(token),
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setChatError(te(data.error) || t("sendFailed"));
      return;
    }
    setText("");
    clearImage();
    if (data.message) {
      setMessages((prev) => (prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]));
    }
    if (data.roomId) {
      setRoomId(data.roomId);
      joinChatRoom(data.roomId);
    }
  }

  function clearImage() {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function pickImage(file) {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setChatError(t("photoFailed"));
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setChatError("");
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

  async function suggestReply() {
    setSuggestBusy(true);
    setChatError("");
    try {
      const res = await fetch("/api/news/ai/suggest-reply", {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          lang,
          peerName: title,
          messages: messages.slice(-8).map((m) => ({
            fromName: m.fromName,
            text: m.text,
            audioUrl: m.audioUrl,
            mediaType: m.mediaType,
            sharedPost: Boolean(m.sharedPost),
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("aiFailed"));
      if (data.suggestion) setText(data.suggestion);
      else setChatError(t("aiFailed"));
    } catch (err) {
      setChatError(te(err.message) || t("aiFailed"));
    } finally {
      setSuggestBusy(false);
    }
  }

  return (
    <div className="chat-wallpaper fixed inset-x-0 top-0 z-50 mx-auto flex h-dvh max-w-lg flex-col">
      <header className="flex items-center gap-2 bg-[var(--forest)] px-3 py-3 text-white">
        <button type="button" onClick={() => navigate("/news/chat")} className="min-h-10 px-2 text-xl">
          ←
        </button>
        {peerId ? (
          <button type="button" onClick={() => navigate(`/news/u/${peerId}`)} className="shrink-0">
            <Avatar name={title} src={members[0]?.avatarUrl} size="sm" />
          </button>
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">👥</span>
        )}
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            if (peerId) navigate(`/news/u/${peerId}`);
          }}
        >
          <p className="truncate font-extrabold">{title}</p>
          <p className="text-xs text-white/75">
            {(customGroup || villageGroup) && members.length
              ? `${members.length} ${t("members")} · ${socketLive ? t("liveShort") : t("connectingShort")}`
              : socketLive
                ? t("liveShort")
                : t("connectingShort")}
          </p>
        </button>
        {customGroup ? (
          <button
            type="button"
            onClick={() => {
              setAdding((v) => !v);
              setAddError("");
            }}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold"
          >
            {t("addPeople")}
          </button>
        ) : null}
      </header>

      {villageGroup && members.length ? (
        <div className="flex gap-3 overflow-x-auto bg-white/80 px-3 py-2">
          {members.map((m) => (
            <button
              key={m._id}
              type="button"
              onClick={() => navigate(`/news/u/${m._id}`)}
              className="flex w-14 shrink-0 flex-col items-center"
            >
              <Avatar name={m.displayName} src={m.avatarUrl} size="sm" />
              <span className="mt-1 w-full truncate text-center text-[10px] font-semibold text-stone-600">
                {m.displayName}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {adding && customGroup ? (
        <div className="space-y-2 bg-white px-3 py-3">
          <MemberPicker
            token={token}
            villagers={[]}
            picked={picked}
            setPicked={setPicked}
            t={t}
            excludeIds={members.map((m) => m._id)}
          />
          {addError ? <p className="text-sm font-semibold text-red-800">{addError}</p> : null}
          <button
            type="button"
            className="btn-primary min-h-10 w-full rounded-xl text-sm font-bold"
            onClick={async () => {
              setAddError("");
              if (!picked.length) {
                setAddError(t("needMembers"));
                return;
              }
              const res = await fetch(`/api/news/chat/groups/${groupId}/members`, {
                method: "POST",
                headers: { ...authHeaders(token), "Content-Type": "application/json" },
                body: JSON.stringify({ memberIds: picked.map((p) => p._id) }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setAddError(te(data.error) || t("needMembers"));
                return;
              }
              setMembers(data.members || []);
              setPicked([]);
              setAdding(false);
            }}
          >
            {t("add")}
          </button>
        </div>
      ) : null}

      <ul className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.map((m) => {
          const mine = m.fromId === user._id;
          return (
            <li key={m._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
                  mine ? "bubble-mine rounded-br-sm" : "rounded-bl-sm bg-white"
                }`}
              >
                {!mine ? <p className="text-xs font-bold text-[var(--forest)]">{m.fromName}</p> : null}
                {m.sharedPost ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (m.sharedPost._id) navigate(`/news/post/${m.sharedPost._id}`);
                      else if (m.sharedPost.authorId) navigate(`/news/u/${m.sharedPost.authorId}`);
                    }}
                    className="mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-black/5 bg-white/90 text-left shadow-sm active:scale-[0.99]"
                  >
                    {m.sharedPost.mediaType === "image" && m.sharedPost.mediaUrl ? (
                      <img src={m.sharedPost.mediaUrl} alt="" className="max-h-44 w-full object-cover" />
                    ) : m.sharedPost.mediaType === "video" && m.sharedPost.mediaUrl ? (
                      <div className="relative bg-black">
                        <video src={m.sharedPost.mediaUrl} className="max-h-44 w-full object-cover" muted />
                        <span className="absolute inset-0 flex items-center justify-center text-2xl text-white">▶</span>
                      </div>
                    ) : null}
                    <div className="px-2.5 py-2">
                      <p className="text-[11px] font-bold text-[var(--forest)]">{m.sharedPost.authorName}</p>
                      {m.sharedPost.text ? (
                        <p className="line-clamp-3 text-[13px] leading-snug text-stone-800">{m.sharedPost.text}</p>
                      ) : (
                        <p className="text-[12px] text-stone-500">{t("sharedPost")}</p>
                      )}
                      <p className="mt-1 text-[11px] font-bold text-[var(--forest)]">{t("tapToOpen")} →</p>
                    </div>
                  </button>
                ) : null}
                {m.mediaType === "image" && m.mediaUrl ? (
                  <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mt-1 block overflow-hidden rounded-xl">
                    <img src={m.mediaUrl} alt="" className="max-h-56 w-full object-cover" />
                  </a>
                ) : null}
                {m.text && !m.sharedPost ? <p className="whitespace-pre-wrap text-[15px] leading-snug">{m.text}</p> : null}
                {m.text && m.sharedPost && m.text !== `📰 ${m.sharedPost.authorName}` ? (
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-snug">{m.text}</p>
                ) : null}
                {m.audioUrl ? <audio src={m.audioUrl} controls className="mt-1 w-full" /> : null}
                <p className="mt-0.5 text-right text-[10px] text-stone-500">{timeOf(m.createdAt, locale)}</p>
              </div>
            </li>
          );
        })}
        {messages.length === 0 ? (
          <li className="py-16 text-center text-sm text-stone-500">{t("startChat")}</li>
        ) : null}
        <li ref={bottomRef} />
      </ul>

      <form
        className="glass flex flex-col gap-2 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        {chatError ? <p className="px-2 text-xs font-semibold text-red-800">{chatError}</p> : null}
        {imagePreview ? (
          <div className="relative mx-1 w-fit">
            <img src={imagePreview} alt="" className="h-20 w-20 rounded-xl object-cover" />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            disabled={suggestBusy}
            onClick={() => void suggestReply()}
            className="rounded-full bg-black/5 px-3 py-1.5 text-xs font-bold text-[var(--forest-deep)] disabled:opacity-40"
          >
            {suggestBusy ? t("suggesting") : t("suggestReply")}
          </button>
        </div>
        <div className="flex gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickImage(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="min-h-12 rounded-full bg-stone-200 px-3 text-lg"
            aria-label={t("sendPhoto")}
          >
            🖼
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("writeMessage")}
            className="min-h-12 flex-1 rounded-full bg-white px-4"
          />
          {rec ? (
            <button type="button" onClick={() => rec.stop()} className="min-h-12 rounded-full bg-red-700 px-4 font-bold text-white">
              {t("stop")}
            </button>
          ) : (
            <button type="button" onClick={() => void startVoice()} className="min-h-12 rounded-full bg-stone-700 px-3 text-white">
              🎤
            </button>
          )}
          <button type="submit" className="btn-primary min-h-12 rounded-full px-4 font-extrabold">
            ➤
          </button>
        </div>
      </form>
    </div>
  );
}

export function ChatScreen() {
  return <ChatInbox />;
}
