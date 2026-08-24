import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { Avatar } from "./Avatar.jsx";
import { useNews } from "./NewsProvider.jsx";

export function VillageFeed({ savedOnly = false }) {
  const { user, token, alert, t, te, locale } = useNews();
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    const url = savedOnly ? "/api/news/posts/saved" : "/api/news/posts";
    const res = await fetch(url, { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok) {
      setError(te(data.error) || t("feedFailed"));
      return;
    }
    setPosts(data.posts || []);
  }

  useEffect(() => {
    void load();
  }, [token, alert, savedOnly]);

  return (
    <div className="space-y-4">
      {savedOnly ? (
        <header className="flex items-center gap-3">
          <Link to="/news/profile" className="min-h-10 rounded-full bg-black/5 px-3 text-lg font-bold text-[var(--forest-deep)]">
            ←
          </Link>
          <div>
            <p className="kicker">SAVED</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">{t("savedPosts")}</h1>
          </div>
        </header>
      ) : (
        <header className="glass rise flex items-center justify-between gap-3 rounded-[1.75rem] px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="kicker">VILLAGE</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{t("villageNews")}</h1>
            <p className="mt-1 truncate font-bold text-[var(--forest-deep)]">{user.villageName}</p>
            <p className="text-sm text-stone-500">
              {user.district} · {t("pinLabel")} {user.pincode}
            </p>
          </div>
          <Link
            to="/news/profile"
            className="shrink-0 rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(14,92,84,0.25)]"
            aria-label={t("profile")}
          >
            <Avatar name={user.displayName || user.email} src={user.avatarUrl} ring />
          </Link>
        </header>
      )}

      {!savedOnly ? (
        <Link
          to="/news/compose"
          className="btn-primary flex min-h-12 items-center justify-center gap-2 rounded-2xl text-base font-extrabold"
        >
          <span aria-hidden>✦</span>
          {t("writeNews")}
        </Link>
      ) : null}

      {error ? <p className="font-semibold text-red-800">{error}</p> : null}

      {posts.length === 0 ? (
        <p className="card rounded-[1.75rem] px-4 py-12 text-center text-lg text-stone-500">
          {savedOnly ? t("emptySaved") : t("emptyFeed")}
        </p>
      ) : (
        <ul className="-mx-4 space-y-5 sm:mx-0 sm:space-y-4">
          {posts.map((post) => (
            <li key={post._id} className="rise">
              <PostCard post={post} token={token} onChange={load} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PostCard({ post, token, onChange, locale }) {
  const { setSession, t, te } = useNews();
  const navigate = useNavigate();
  const viewed = useRef(false);
  const [open, setOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [viewCount, setViewCount] = useState(post.viewCount || 0);
  const [repostCount, setRepostCount] = useState(post.repostCount || 0);
  const [reposted, setReposted] = useState(post.reposted);
  const [saved, setSaved] = useState(post.saved);
  const [toast, setToast] = useState("");

  const actionId = post.isRepost && post.originalPostId ? post.originalPostId : post._id;
  const displayName = post.isRepost ? post.originalAuthorName || post.authorName : post.authorName;

  useEffect(() => {
    setLiked(post.liked);
    setLikeCount(post.likeCount || 0);
    setViewCount(post.viewCount || 0);
    setRepostCount(post.repostCount || 0);
    setReposted(post.reposted);
    setSaved(post.saved);
  }, [post]);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    (async () => {
      const res = await fetch(`/api/news/posts/${post._id}/view`, {
        method: "POST",
        headers: authHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setViewCount(data.viewCount || 0);
    })();
  }, [post._id, token]);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  async function like() {
    const res = await fetch(`/api/news/posts/${actionId}/like`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (res.ok) {
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    }
  }

  async function repost() {
    const res = await fetch(`/api/news/posts/${actionId}/repost`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(te(data.error) || t("repostFailed"));
      return;
    }
    setReposted(data.reposted);
    setRepostCount(data.repostCount || 0);
    flash(data.reposted ? t("reposted") : t("unreposted"));
    onChange?.();
  }

  async function save() {
    const res = await fetch(`/api/news/posts/${actionId}/save`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(te(data.error) || t("saveFailed"));
      return;
    }
    setSaved(data.saved);
    if (data.user) setSession({ token, user: data.user });
    flash(data.saved ? t("postSaved") : t("postUnsaved"));
  }

  async function share() {
    const url = `${window.location.origin}/news?post=${actionId}`;
    const title = t("villageNews");
    const body = post.text?.slice(0, 120) || t("sharedPost");
    try {
      if (navigator.share) {
        await navigator.share({ title, text: body, url });
      } else {
        await navigator.clipboard.writeText(url);
        flash(t("linkCopied"));
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        flash(t("linkCopied"));
      } catch {
        flash(t("shareFailed"));
      }
    }
  }

  async function loadComments() {
    const res = await fetch(`/api/news/posts/${post._id}/comments`, {
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (res.ok) setComments(data.comments || []);
  }

  async function sendComment(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const body = new FormData();
    body.append("text", text.trim());
    const res = await fetch(`/api/news/posts/${post._id}/comments`, {
      method: "POST",
      headers: authHeaders(token),
      body,
    });
    if (res.ok) {
      setText("");
      await loadComments();
      onChange?.();
    }
  }

  return (
    <article className="ig-post overflow-hidden bg-[var(--paper)] sm:rounded-[1.25rem] sm:border sm:border-[var(--line)]">
      {post.isRepost ? (
        <p className="flex items-center gap-1.5 px-3 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-stone-400">
          <IconRepost className="h-3 w-3" />
          {post.authorName} {t("repostedBy")}
        </p>
      ) : null}

      <div className="flex items-center gap-3 px-3 py-2.5">
        <Link
          to={`/news/u/${post.isRepost ? post.originalAuthorId || post.authorId : post.authorId}`}
          className="shrink-0"
        >
          <Avatar name={displayName} src={post.authorAvatar} size="sm" />
        </Link>
        <Link
          to={`/news/u/${post.isRepost ? post.originalAuthorId || post.authorId : post.authorId}`}
          className="min-w-0 flex-1"
        >
          <p className="truncate text-sm font-extrabold text-[var(--ink)]">{displayName}</p>
          <p className="truncate text-[11px] text-stone-400">
            {post.villageName} · {new Date(post.createdAt).toLocaleString(locale)}
          </p>
        </Link>
        <button type="button" onClick={() => void share()} className="ig-icon" aria-label={t("share")}>
          <IconMore />
        </button>
      </div>

      {post.mediaType === "image" && post.mediaUrl ? (
        <Link to={`/news/post/${post._id}`} className="block">
          <img src={post.mediaUrl} alt="" className="max-h-[32rem] w-full bg-black object-contain" />
        </Link>
      ) : null}
      {post.mediaType === "video" && post.mediaUrl ? (
        <video src={post.mediaUrl} controls playsInline className="max-h-[32rem] w-full bg-black" />
      ) : null}
      {post.audioUrl || (post.mediaType === "audio" && post.mediaUrl) ? (
        <div className="px-3 py-3">
          <audio src={post.audioUrl || post.mediaUrl} controls className="w-full" />
        </div>
      ) : null}

      <div className="flex items-center gap-1 px-1.5 pt-1">
        <button type="button" onClick={() => void like()} className={`ig-icon ${liked ? "text-red-500" : ""}`} aria-label="like">
          <IconHeart filled={liked} />
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) void loadComments();
          }}
          className="ig-icon"
          aria-label={t("comments")}
        >
          <IconComment />
        </button>
        <button type="button" onClick={() => setSendOpen(true)} className="ig-icon" aria-label={t("sendTo")}>
          <IconSend />
        </button>
        <button
          type="button"
          onClick={() => void repost()}
          className={`ig-icon ${reposted ? "text-[var(--forest)]" : ""}`}
          aria-label="repost"
        >
          <IconRepost />
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => void save()} className={`ig-icon ${saved ? "text-[var(--ink)]" : ""}`} aria-label="save">
          <IconBookmark filled={saved} />
        </button>
      </div>

      <div className="space-y-1 px-3 pb-3 pt-0.5">
        {likeCount > 0 ? (
          <p className="text-sm font-extrabold text-[var(--ink)]">
            {likeCount} {likeCount === 1 ? "like" : "likes"}
          </p>
        ) : null}
        {post.text ? (
          <p className="text-[15px] leading-snug text-[var(--ink)]">
            <Link
              to={`/news/u/${post.isRepost ? post.originalAuthorId || post.authorId : post.authorId}`}
              className="font-extrabold"
            >
              {displayName}
            </Link>{" "}
            {post.text}
          </p>
        ) : null}
        {(post.commentCount || 0) > 0 && !open ? (
          <button
            type="button"
            className="text-sm font-semibold text-stone-400"
            onClick={() => {
              setOpen(true);
              void loadComments();
            }}
          >
            {t("comments")} {post.commentCount}
          </button>
        ) : null}
        <p className="text-[11px] font-semibold text-stone-400">
          👁 {viewCount} {t("views")}
          {repostCount ? ` · ↻ ${repostCount}` : ""}
        </p>
        {toast ? <p className="text-xs font-bold text-[var(--forest)]">{toast}</p> : null}
      </div>

      {open ? (
        <div className="space-y-2 border-t border-[var(--line)] px-3 pb-3 pt-3">
          {comments.map((c) => (
            <div key={c._id} className="flex gap-2">
              <Avatar name={c.authorName} size="sm" />
              <div className="min-w-0 rounded-2xl bg-black/[0.03] px-3 py-2">
                <p className="text-sm font-bold">{c.authorName}</p>
                {c.text ? <p className="text-sm">{c.text}</p> : null}
                {c.audioUrl ? <audio src={c.audioUrl} controls className="mt-1 w-full" /> : null}
              </div>
            </div>
          ))}
          <form onSubmit={sendComment} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("writeComment")}
              className="input-field min-h-11 flex-1"
            />
            <button className="btn-primary min-h-11 rounded-xl px-3 text-sm font-bold">{t("send")}</button>
          </form>
          <AudioComment postId={post._id} token={token} onDone={loadComments} />
        </div>
      ) : null}

      {sendOpen ? (
        <SendSheet
          postId={actionId}
          token={token}
          onClose={() => setSendOpen(false)}
          onSent={(peerId) => {
            setSendOpen(false);
            flash(t("postSent"));
            navigate(`/news/chat/dm/${peerId}`);
          }}
        />
      ) : null}
    </article>
  );
}

function IconHeart({ filled }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
      <path d="M12 21s-6.7-4.35-9.33-7.4C.7 11.3 1.1 7.6 3.9 6.1c2.1-1.1 4.5-.4 5.8 1.4C11 5.7 13.4 5 15.5 6.1c2.8 1.5 3.2 5.2 1.23 7.5C18.7 16.65 12 21 12 21z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]" aria-hidden>
      <path d="M12.1 20.3c-.1 0-.1 0-.2 0C7.1 17.3 3.5 13.9 3.5 9.8 3.5 7.1 5.6 5 8.2 5c1.5 0 2.9.7 3.8 1.8C12.9 5.7 14.3 5 15.8 5c2.6 0 4.7 2.1 4.7 4.8 0 4.1-3.6 7.5-8.4 10.5z" />
    </svg>
  );
}

function IconComment() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]" aria-hidden>
      <path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H7l-3.5 2.2V12A7.5 7.5 0 1 1 20 12Z" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]" aria-hidden>
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

function IconRepost({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-none stroke-current stroke-[1.8]`} aria-hidden>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconBookmark({ filled }) {
  return filled ? (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
      <path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]" aria-hidden>
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-3.8L5 21V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function SendSheet({ postId, token, onClose, onSent }) {
  const { t, te } = useNews();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/news/chat/inbox", { headers: authHeaders(token) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setSuggested(data.villagers || []);
    })();
  }, [token]);

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
        const data = await res.json().catch(() => ({}));
        if (res.ok) setHits(data.users || []);
        else setHits([]);
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q, token]);

  async function sendTo(peerId) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/news/posts/${postId}/send`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ peerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("sendFailed"));
      onSent?.(peerId);
    } catch (err) {
      setError(te(err.message));
    } finally {
      setBusy(false);
    }
  }

  const list = q.trim().length >= 2 ? hits : suggested;

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-extrabold text-[var(--ink)]">{t("sendTo")}</p>
          <button type="button" onClick={onClose} className="text-sm font-bold text-stone-400">
            {t("close")}
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPeople")}
          className="input-field mb-3 min-h-11"
          autoFocus
        />
        {error ? <p className="mb-2 text-sm font-semibold text-red-800">{error}</p> : null}
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {searching ? <p className="py-6 text-center text-sm text-stone-500">{t("searching")}</p> : null}
          {!searching &&
            list.map((p) => (
              <button
                key={p._id}
                type="button"
                disabled={busy}
                onClick={() => void sendTo(p._id)}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-black/[0.03]"
              >
                <Avatar name={p.displayName} src={p.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{p.displayName}</span>
                  <span className="block truncate text-xs text-stone-400">{p.email || p.villageName}</span>
                </span>
                <span className="rounded-full bg-[var(--forest)] px-3 py-1 text-xs font-bold text-white">{t("send")}</span>
              </button>
            ))}
          {!searching && q.trim().length >= 2 && hits.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">{t("noUser")}</p>
          ) : null}
          {!searching && q.trim().length < 2 && suggested.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-500">{t("typeToSend")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AudioComment({ postId, token, onDone }) {
  const { t } = useNews();
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const body = new FormData();
      body.append("audio", blob, "voice.webm");
      setBusy(true);
      await fetch(`/api/news/posts/${postId}/comments`, {
        method: "POST",
        headers: authHeaders(token),
        body,
      });
      setBusy(false);
      setRec(null);
      onDone?.();
    };
    recorder.start();
    setRec(recorder);
  }

  return rec ? (
    <button type="button" onClick={() => rec.stop()} className="min-h-11 w-full rounded-xl bg-red-700 font-bold text-white">
      {t("stopSend")}
    </button>
  ) : (
    <button
      type="button"
      disabled={busy}
      onClick={() => void start()}
      className="min-h-11 w-full rounded-xl bg-[var(--ink)] font-bold text-white"
    >
      {t("voiceComment")}
    </button>
  );
}
