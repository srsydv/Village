import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { PostCard } from "./VillageFeed.jsx";
import { useNews } from "./NewsProvider.jsx";

export function PostDetail() {
  const { postId } = useParams();
  const { token, t, te, locale } = useNews();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/news/posts/${postId}`, { headers: authHeaders(token) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(te(data.error) || t("feedFailed"));
      return;
    }
    setPost(data.post);
  }

  useEffect(() => {
    if (postId && token) void load();
  }, [postId, token]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="min-h-10 rounded-full bg-black/5 px-3 text-lg font-bold text-[var(--forest-deep)]"
        >
          ←
        </button>
        <h1 className="text-lg font-extrabold text-[var(--ink)]">{t("postDetail")}</h1>
        {post?.authorId ? (
          <Link to={`/news/u/${post.isRepost ? post.originalAuthorId || post.authorId : post.authorId}`} className="ml-auto text-sm font-bold text-[var(--forest)]">
            {t("viewProfile")}
          </Link>
        ) : null}
      </div>

      {error ? <p className="card rounded-2xl px-4 py-8 text-center font-semibold text-red-800">{error}</p> : null}
      {!error && !post ? <p className="py-16 text-center text-stone-500">{t("loading")}</p> : null}
      {post ? <PostCard post={post} token={token} onChange={load} locale={locale} /> : null}
    </div>
  );
}
