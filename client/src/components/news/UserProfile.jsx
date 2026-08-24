import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { Avatar } from "./Avatar.jsx";
import { useNews } from "./NewsProvider.jsx";

export function UserProfile() {
  const { userId } = useParams();
  const { token, user: me, t, te } = useNews();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isSelf, setIsSelf] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("posts");

  useEffect(() => {
    if (!userId || !token) return;
    (async () => {
      setError("");
      const res = await fetch(`/api/news/users/${userId}`, { headers: authHeaders(token) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(te(data.error) || t("noUser"));
        return;
      }
      setProfile(data.user);
      setStats(data.stats);
      setPosts(data.posts || []);
      setIsSelf(Boolean(data.isSelf));
    })();
  }, [userId, token]);

  if (error) {
    return (
      <div className="space-y-4">
        <Back />
        <p className="card rounded-2xl px-4 py-8 text-center font-semibold text-red-800">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <Back />
        <p className="py-16 text-center text-stone-500">{t("loading")}</p>
      </div>
    );
  }

  const grid = posts.filter((p) => (tab === "reposts" ? p.isRepost : !p.isRepost));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Back />
        <h1 className="truncate text-lg font-extrabold text-[var(--ink)]">{profile.displayName}</h1>
      </div>

      <section className="card rounded-[1.75rem] p-4">
        <div className="flex items-center gap-4">
          <Avatar name={profile.displayName} src={profile.avatarUrl} size="xl" ring />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-extrabold text-[var(--ink)]">{profile.displayName}</p>
            <p className="truncate text-sm text-stone-500">{profile.villageName}</p>
            <p className="truncate text-xs text-stone-400">
              {profile.district} · {t("pinLabel")} {profile.pincode}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat n={stats?.posts || 0} label={t("postsCount")} />
          <Stat n={stats?.likes || 0} label="likes" />
          <Stat n={stats?.views || 0} label={t("views")} />
        </div>

        <div className="mt-4 flex gap-2">
          {isSelf ? (
            <Link to="/news/profile" className="btn-primary flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-bold">
              {t("editProfile")}
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(`/news/chat/dm/${profile._id}`)}
                className="btn-primary min-h-11 flex-1 rounded-xl text-sm font-bold"
              >
                {t("messageUser")}
              </button>
              <Link
                to="/news/compose"
                className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-black/5 text-sm font-bold text-[var(--ink)]"
              >
                {t("writeNews")}
              </Link>
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-1 rounded-full bg-black/5 p-1">
        <button
          type="button"
          onClick={() => setTab("posts")}
          className={`min-h-10 rounded-full text-sm font-bold ${
            tab === "posts" ? "bg-white text-[var(--forest-deep)] shadow-sm" : "text-stone-500"
          }`}
        >
          {t("postsCount")}
        </button>
        <button
          type="button"
          onClick={() => setTab("reposts")}
          className={`min-h-10 rounded-full text-sm font-bold ${
            tab === "reposts" ? "bg-white text-[var(--forest-deep)] shadow-sm" : "text-stone-500"
          }`}
        >
          {t("repostsTab")}
        </button>
      </div>

      {grid.length === 0 ? (
        <p className="card rounded-[1.75rem] px-4 py-12 text-center text-stone-500">{t("emptyProfile")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-1">
          {grid.map((p) => (
            <Link key={p._id} to={`/news/post/${p._id}`} className="relative aspect-square overflow-hidden bg-stone-200">
              {p.mediaType === "image" && p.mediaUrl ? (
                <img src={p.mediaUrl} alt="" className="h-full w-full object-cover" />
              ) : p.mediaType === "video" && p.mediaUrl ? (
                <div className="relative h-full w-full bg-black">
                  <video src={p.mediaUrl} className="h-full w-full object-cover" muted />
                  <span className="absolute right-1 top-1 text-xs text-white">▶</span>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center bg-[var(--cream)] px-2 text-center text-[11px] font-semibold text-stone-600">
                  {(p.text || "·").slice(0, 40)}
                </div>
              )}
              {p.isRepost ? (
                <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1 text-[10px] font-bold text-white">↻</span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div className="rounded-2xl bg-[var(--cream)] px-2 py-2">
      <p className="text-lg font-extrabold text-[var(--ink)]">{n}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
    </div>
  );
}

function Back() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="min-h-10 rounded-full bg-black/5 px-3 text-lg font-bold text-[var(--forest-deep)]"
    >
      ←
    </button>
  );
}
