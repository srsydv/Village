import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { InstallPrompt } from "../InstallPrompt.jsx";
import { Avatar } from "./Avatar.jsx";
import { LanguageToggle } from "./LanguageToggle.jsx";
import { useNews } from "./NewsProvider.jsx";

const APP_VERSION = "0.1.0";

export function ProfileScreen() {
  const { user, token, setSession, logout, t, te } = useNews();
  const fileRef = useRef(null);
  const [name, setName] = useState(user?.displayName || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function applyUser(nextUser) {
    setSession({ token, user: nextUser });
  }

  async function saveName(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const res = await fetch("/api/news/me", {
        method: "PATCH",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("saveFailed"));
      await applyUser(data.user);
      setMsg(t("saved"));
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
    setMsg("");
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
    setError("");
    setMsg("");
    setBusy(true);
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

  if (!user) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to="/news" className="min-h-10 rounded-full bg-black/5 px-3 text-lg font-bold text-[var(--forest-deep)]">
          ←
        </Link>
        <div>
          <p className="kicker">PROFILE</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">{t("profile")}</h1>
        </div>
      </div>

      <section className="glass rise relative overflow-hidden rounded-[2rem] px-5 pb-6 pt-8 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(14,92,84,0.18),transparent)]" />
        <div className="relative mx-auto inline-block">
          <Avatar name={user.displayName} src={user.avatarUrl} size="xl" ring />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="btn-primary absolute -bottom-1 -right-1 flex h-11 w-11 items-center justify-center rounded-full text-lg shadow-lg"
            aria-label={t("changePhoto")}
          >
            📷
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onAvatar} />
        </div>
        <p className="mt-5 text-2xl font-extrabold text-[var(--ink)]">{user.displayName}</p>
        <p className="mt-1 text-sm font-medium text-stone-500">{user.email}</p>
        {user.avatarUrl ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void removeAvatar()}
            className="mt-3 text-sm font-bold text-stone-400"
          >
            {t("removePhoto")}
          </button>
        ) : (
          <p className="mt-3 text-sm font-semibold text-[var(--forest)]">{t("tapToAddPhoto")}</p>
        )}
      </section>

      <section className="card space-y-3 rounded-[1.75rem] p-4">
        <p className="text-sm font-extrabold text-[var(--ink)]">{t("yourName")}</p>
        <form onSubmit={saveName} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field min-h-12 flex-1"
            required
          />
          <button disabled={busy} className="btn-primary min-h-12 rounded-xl px-4 font-bold">
            {t("save")}
          </button>
        </form>
      </section>

      <section className="card space-y-3 rounded-[1.75rem] p-4">
        <p className="text-sm font-extrabold text-[var(--ink)]">{t("language")}</p>
        <LanguageToggle compact />
      </section>

      <section className="card space-y-2 rounded-[1.75rem] p-4">
        <p className="kicker">{t("yourVillage")}</p>
        <p className="text-xl font-extrabold text-[var(--forest-deep)]">{user.villageName}</p>
        <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
          <div className="rounded-2xl bg-[var(--cream)] px-3 py-2">
            <p className="text-[11px] font-bold text-stone-400">{t("pinLabel")}</p>
            <p className="font-extrabold">{user.pincode}</p>
          </div>
          <div className="rounded-2xl bg-[var(--cream)] px-3 py-2">
            <p className="text-[11px] font-bold text-stone-400">{t("district")}</p>
            <p className="font-extrabold">{user.district}</p>
          </div>
          <div className="col-span-2 rounded-2xl bg-[var(--cream)] px-3 py-2">
            <p className="text-[11px] font-bold text-stone-400">{t("state")}</p>
            <p className="font-extrabold">{user.state}</p>
          </div>
          {user.postOffice ? (
            <div className="col-span-2 rounded-2xl bg-[var(--cream)] px-3 py-2">
              <p className="text-[11px] font-bold text-stone-400">{t("postOffice")}</p>
              <p className="font-extrabold">{user.postOffice}</p>
            </div>
          ) : null}
        </div>
      </section>

      <InstallPrompt />

      <Link
        to="/news/saved"
        className="card flex min-h-14 items-center justify-between rounded-[1.75rem] px-4 font-extrabold text-[var(--ink)]"
      >
        <span>🔖 {t("savedPosts")}</span>
        <span className="text-stone-400">→</span>
      </Link>

      <section className="card rounded-[1.75rem] p-4">
        <p className="text-sm font-extrabold text-[var(--ink)]">{t("aboutApp")}</p>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">{t("aboutBody")}</p>
        <p className="mt-3 text-xs font-bold text-stone-400">
          Village · v{APP_VERSION}
        </p>
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm font-semibold text-red-800">{error}</p> : null}
      {msg ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-sm font-semibold text-emerald-900">{msg}</p> : null}

      <button
        type="button"
        onClick={logout}
        className="min-h-14 w-full rounded-2xl bg-[var(--ink)] text-lg font-extrabold text-white"
      >
        {t("logout")}
      </button>
    </div>
  );
}
