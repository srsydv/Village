import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { useNews } from "./NewsProvider.jsx";

export function VillageFeed() {
  const { user, token, logout, alert } = useNews();
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/news/posts", { headers: authHeaders(token) });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "फीड नहीं खुला");
      return;
    }
    setPosts(data.posts || []);
  }

  useEffect(() => {
    void load();
  }, [token, alert]);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.2em] text-stone-500">VILLAGE</p>
          <h1 className="mt-1 text-3xl font-black text-teal-950">गाँव की खबर</h1>
          <p className="font-semibold text-stone-700">{user.villageName}</p>
          <p className="text-sm text-stone-500">
            {user.district} · पिन {user.pincode}
          </p>
          {user.email ? <p className="text-xs text-stone-400">{user.email}</p> : null}
        </div>
        <button type="button" onClick={logout} className="text-sm font-semibold text-stone-500">
          बाहर
        </button>
      </header>

      <Link
        to="/news/compose"
        className="flex min-h-14 items-center justify-center rounded-2xl bg-teal-800 text-lg font-black text-white"
      >
        📸 खबर लिखें
      </Link>

      {error ? <p className="font-semibold text-red-800">{error}</p> : null}

      {posts.length === 0 ? (
        <p className="rounded-2xl bg-stone-100 px-4 py-10 text-center text-lg text-stone-600">
          अभी गाँव से कोई खबर नहीं। पहली आप लिखें।
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post._id}>
              <PostCard post={post} token={token} onChange={load} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PostCard({ post, token, onChange }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);

  async function like() {
    const res = await fetch(`/api/news/posts/${post._id}/like`, {
      method: "POST",
      headers: authHeaders(token),
    });
    const data = await res.json();
    if (res.ok) {
      setLiked(data.liked);
      setLikeCount(data.likeCount);
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
    <article className="rounded-3xl bg-white p-4 shadow-sm">
      <p className="font-black text-teal-950">{post.authorName}</p>
      <p className="text-xs text-stone-500">
        {post.villageName} · {new Date(post.createdAt).toLocaleString("hi-IN")}
      </p>
      {post.text ? <p className="mt-2 text-lg leading-snug">{post.text}</p> : null}
      {post.mediaType === "image" && post.mediaUrl ? (
        <img
          src={post.mediaUrl}
          alt=""
          className="mt-3 max-h-80 w-full rounded-2xl object-cover"
        />
      ) : null}
      {post.mediaType === "video" && post.mediaUrl ? (
        <video src={post.mediaUrl} controls className="mt-3 w-full rounded-2xl" />
      ) : null}
      {post.audioUrl ? (
        <audio src={post.audioUrl} controls className="mt-3 w-full" />
      ) : post.mediaType === "audio" && post.mediaUrl ? (
        <audio src={post.mediaUrl} controls className="mt-3 w-full" />
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => void like()}
          className={`min-h-11 rounded-xl px-3 text-sm font-bold ${
            liked ? "bg-teal-800 text-white" : "bg-stone-100 text-stone-700"
          }`}
        >
          ♥ {likeCount}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            if (!open) void loadComments();
          }}
          className="min-h-11 rounded-xl bg-stone-100 px-3 text-sm font-bold text-stone-700"
        >
          टिप्पणी {post.commentCount || 0}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2">
          {comments.map((c) => (
            <div key={c._id} className="rounded-2xl bg-stone-50 px-3 py-2">
              <p className="text-sm font-bold">{c.authorName}</p>
              {c.text ? <p>{c.text}</p> : null}
              {c.audioUrl ? <audio src={c.audioUrl} controls className="mt-1 w-full" /> : null}
            </div>
          ))}
          <form onSubmit={sendComment} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="टिप्पणी लिखें"
              className="min-h-12 flex-1 rounded-xl border-2 border-stone-200 px-3"
            />
            <button className="min-h-12 rounded-xl bg-teal-800 px-3 font-bold text-white">
              भेजें
            </button>
          </form>
          <AudioComment postId={post._id} token={token} onDone={loadComments} />
        </div>
      ) : null}
    </article>
  );
}

function AudioComment({ postId, token, onDone }) {
  const [rec, setRec] = useState(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
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
    <button
      type="button"
      onClick={() => rec.stop()}
      className="min-h-11 w-full rounded-xl bg-red-700 font-bold text-white"
    >
      रोकें और भेजें
    </button>
  ) : (
    <button
      type="button"
      disabled={busy}
      onClick={() => void start()}
      className="min-h-11 w-full rounded-xl bg-stone-800 font-bold text-white"
    >
      🎤 आवाज़ से टिप्पणी
    </button>
  );
}
