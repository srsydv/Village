import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { InstallPrompt } from "../InstallPrompt.jsx";
import { Avatar } from "./Avatar.jsx";
import { LanguageToggle } from "./LanguageToggle.jsx";
import { useNews } from "./NewsProvider.jsx";

const APP_VERSION = "0.1.0";

export function ProfileScreen() {
  const { user, token, setSession, logout, t, te } = useNews();
  const [params, setParams] = useSearchParams();
  const fileRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [tab, setTab] = useState("posts");
  const [editing, setEditing] = useState(params.get("edit") === "1");
  const [name, setName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setName(user?.displayName || "");
    setBio(user?.bio || "");
  }, [user?.displayName, user?.bio]);

  useEffect(() => {
    if (params.get("edit") === "1") setEditing(true);
  }, [params]);

  async function loadProfile() {
    if (!user?._id || !token) return;
    const [uRes, sRes] = await Promise.all([
      fetch(`/api/news/users/${user._id}`, { headers: authHeaders(token) }),
      fetch("/api/news/posts/saved", { headers: authHeaders(token) }),
    ]);
    const uData = await uRes.json().catch(() => ({}));
    const sData = await sRes.json().catch(() => ({}));
    if (uRes.ok) {
      setStats(uData.stats || null);
      setPosts(uData.posts || []);
      if (uData.user) setSession({ token, user: { ...user, ...uData.user } });
    }
    if (sRes.ok) setSavedPosts(sData.posts || []);
  }

  useEffect(() => {
    void loadProfile();
  }, [user?._id, token]);

  async function applyUser(nextUser) {
    setSession({ token, user: nextUser });
  }

  async function saveProfile(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/news/me", {
        method: "PATCH",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim(), bio: bio.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("saveFailed"));
      await applyUser(data.user);
      setMsg(t("saved"));
      setEditing(false);
      setParams({});
      await loadProfile();
    } catch (err) {
      setError(te(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("avatar", file);
      const res = await fetch("/api/news/me/avatar", {
        method: "POST",
        headers: authHeaders(token),
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("photoFailed"));
      await applyUser(data.user);
      setMsg(t("photoUpdated"));
    } catch (err) {
      setError(te(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/news/me/avatar", {
        method: "DELETE",
        headers: authHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("photoFailed"));
      await applyUser(data.user);
      setMsg(t("photoRemoved"));
    } catch (err) {
      setError(te(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function shareProfile() {
    const url = `${window.location.origin}/news/u/${user._id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: user.displayName, text: t("profile"), url });
      } else {
        await navigator.clipboard.writeText(url);
        setToast(t("linkCopied"));
        setTimeout(() => setToast(""), 1600);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setToast(t("linkCopied"));
        setTimeout(() => setToast(""), 1600);
      } catch {
        /* ignore */
      }
    }
  }

  if (!user) return null;

  const grid =
    tab === "saved"
      ? savedPosts
      : tab === "reposts"
        ? posts.filter((p) => p.isRepost)
        : posts.filter((p) => !p.isRepost);

  return (
    <div className="-mx-4 space-y-0 sm:mx-0">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link to="/news" className="min-h-10 rounded-full bg-black/5 px-3 text-lg font-bold text-[var(--forest-deep)]">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold text-[var(--ink)]">{user.displayName}</h1>
        <button type="button" onClick={() => setEditing(true)} className="text-sm font-bold text-[var(--forest)]">
          {t("editProfile")}
        </button>
      </header>

      <section className="px-4 pb-3">
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative shrink-0" aria-label={t("changePhoto")}>
            <Avatar name={user.displayName} src={user.avatarUrl} size="xl" ring />
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--forest)] text-sm text-white shadow">
              +
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onAvatar} />
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1 text-center">
            <Stat n={stats?.posts || 0} label={t("postsCount")} />
            <Stat n={stats?.likes || 0} label="likes" />
            <Stat n={savedPosts.length} label={t("savedShort")} />
          </div>
        </div>

        <div className="mt-3">
          <p className="text-sm font-extrabold text-[var(--ink)]">{user.displayName}</p>
          {user.bio ? <p className="mt-0.5 text-sm leading-snug text-stone-700">{user.bio}</p> : null}
          <p className="mt-1 text-sm font-semibold text-[var(--forest-deep)]">{user.villageName}</p>
          <p className="text-xs text-stone-400">
            {user.district}, {user.state} · {t("pinLabel")} {user.pincode}
          </p>
          {user.email ? <p className="text-xs text-stone-400">{user.email}</p> : null}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-9 rounded-lg bg-black/5 text-sm font-bold text-[var(--ink)]"
          >
            {t("editProfile")}
          </button>
          <button
            type="button"
            onClick={() => void shareProfile()}
            className="min-h-9 rounded-lg bg-black/5 text-sm font-bold text-[var(--ink)]"
          >
            {t("shareProfile")}
          </button>
          <Link
            to="/news/compose"
            className="flex min-h-9 items-center justify-center rounded-lg bg-[var(--forest)] text-sm font-bold text-white"
          >
            {t("navCompose")}
          </Link>
        </div>
        {toast ? <p className="mt-2 text-center text-xs font-bold text-[var(--forest)]">{toast}</p> : null}
      </section>

      <div className="grid grid-cols-3 border-y border-[var(--line)]">
        {[
          ["posts", "▦", t("postsCount")],
          ["reposts", "↻", t("repostsTab")],
          ["saved", "🔖", t("savedShort")],
        ].map(([id, icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              tab === id ? "border-t-2 border-[var(--ink)] text-[var(--ink)]" : "text-stone-400"
            }`}
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {grid.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-5xl text-stone-300">▦</p>
          <p className="mt-3 text-lg font-extrabold text-[var(--ink)]">
            {tab === "saved" ? t("emptySaved") : t("emptyProfile")}
          </p>
          {tab === "posts" ? (
            <Link to="/news/compose" className="btn-primary mt-4 inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-bold">
              {t("writeNews")}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {grid.map((p) => (
            <Link key={p._id} to={`/news/post/${p._id}`} className="relative aspect-square overflow-hidden bg-stone-200">
              {p.mediaType === "image" && p.mediaUrl ? (
                <img src={p.mediaUrl} alt="" className="h-full w-full object-cover" />
              ) : p.mediaType === "video" && p.mediaUrl ? (
                <div className="relative h-full w-full bg-black">
                  <video src={p.mediaUrl} className="h-full w-full object-cover" muted playsInline />
                  <span className="absolute right-1.5 top-1.5 text-xs text-white">▶</span>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center bg-[var(--cream)] px-2 text-center text-[11px] font-semibold text-stone-600">
                  {(p.text || "·").slice(0, 48)}
                </div>
              )}
              {p.isRepost ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] font-bold text-white">↻</span>
              ) : null}
              {(p.likeCount || 0) > 0 ? (
                <span className="absolute bottom-1 right-1 rounded bg-black/45 px-1 text-[10px] font-bold text-white">
                  ♥ {p.likeCount}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      {editing ? (
        <div className="sheet-backdrop" onClick={() => { setEditing(false); setParams({}); }} role="presentation">
          <div className="sheet-panel max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-extrabold">{t("editProfile")}</p>
              <button type="button" onClick={() => { setEditing(false); setParams({}); }} className="text-sm font-bold text-stone-400">
                {t("close")}
              </button>
            </div>

            <div className="mb-4 flex flex-col items-center">
              <Avatar name={user.displayName} src={user.avatarUrl} size="xl" ring />
              <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className="mt-2 text-sm font-bold text-[var(--forest)]">
                {t("changePhoto")}
              </button>
              {user.avatarUrl ? (
                <button type="button" disabled={busy} onClick={() => void removeAvatar()} className="mt-1 text-xs font-bold text-stone-400">
                  {t("removePhoto")}
                </button>
              ) : null}
            </div>

            <form onSubmit={saveProfile} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-stone-500">{t("yourName")}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input-field min-h-11" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-stone-500">{t("bio")}</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 160))}
                  rows={3}
                  placeholder={t("bioHint")}
                  className="input-field min-h-24"
                />
                <span className="mt-1 block text-right text-[11px] text-stone-400">{bio.length}/160</span>
              </label>
              <div>
                <p className="mb-1 text-xs font-bold text-stone-500">{t("language")}</p>
                <LanguageToggle compact />
              </div>
              {error ? <p className="text-sm font-semibold text-red-800">{error}</p> : null}
              {msg ? <p className="text-sm font-semibold text-emerald-800">{msg}</p> : null}
              <button disabled={busy} className="btn-primary min-h-12 w-full rounded-xl font-bold">
                {t("save")}
              </button>
            </form>

            <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">
              <InstallPrompt />
              <p className="text-xs font-bold text-stone-400">Village · v{APP_VERSION}</p>
              <p className="text-sm text-stone-500">{t("aboutBody")}</p>
              <button type="button" onClick={logout} className="min-h-12 w-full rounded-xl bg-[var(--ink)] font-bold text-white">
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div>
      <p className="text-lg font-extrabold leading-none text-[var(--ink)]">{n}</p>
      <p className="mt-1 text-[11px] font-semibold text-stone-500">{label}</p>
    </div>
  );
}
