import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { useNews } from "./NewsProvider.jsx";

export function ComposePost() {
  const { token, user } = useNews();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [visual, setVisual] = useState(null);
  const [visualPreview, setVisualPreview] = useState("");
  const [visualKind, setVisualKind] = useState("none");
  const [audio, setAudio] = useState(null);
  const [audioPreview, setAudioPreview] = useState("");
  const [rec, setRec] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (visualPreview) URL.revokeObjectURL(visualPreview);
    setVisual(f);
    setVisualKind(f.type.startsWith("video") ? "video" : "image");
    setVisualPreview(URL.createObjectURL(f));
  }

  async function startVoice() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    recorder.ondataavailable = (ev) => chunks.push(ev.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const f = new File([blob], "voice.webm", { type: blob.type });
      if (audioPreview) URL.revokeObjectURL(audioPreview);
      setAudio(f);
      setAudioPreview(URL.createObjectURL(blob));
      setRec(null);
    };
    recorder.start();
    setRec(recorder);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!text.trim() && !visual && !audio) {
      setError("लिखें, फोटो/वीडियो, या आवाज़ जोड़ें");
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("text", text.trim());
      if (visual) body.append("media", visual);
      if (audio) body.append("audio", audio);
      const res = await fetch("/api/news/posts", {
        method: "POST",
        headers: authHeaders(token),
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "पोस्ट नहीं बनी");
      navigate("/news");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="text-3xl font-black text-teal-950">खबर लिखें</h1>
      <p className="text-sm font-semibold text-stone-600">
        {user.villageName} · {user.pincode} पर लगेगी
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="गाँव में क्या हुआ? हिंदी में लिखें"
        className="w-full rounded-3xl border-2 border-stone-200 bg-white p-4 text-lg"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-h-16 items-center justify-center rounded-2xl bg-white font-bold shadow-sm">
          📷 फोटो/वीडियो
          <input type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={onFile} />
        </label>
        {rec ? (
          <button
            type="button"
            onClick={() => rec.stop()}
            className="min-h-16 rounded-2xl bg-red-700 font-bold text-white"
          >
            रोकें
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startVoice()}
            className="min-h-16 rounded-2xl bg-stone-800 font-bold text-white"
          >
            {audio ? "🎤 आवाज़ बदलें" : "🎤 आवाज़"}
          </button>
        )}
      </div>
      <p className="text-center text-sm font-semibold text-stone-500">
        फोटो/वीडियो और आवाज़ दोनों लगा सकते हैं
      </p>

      {visualKind === "image" && visualPreview ? (
        <img src={visualPreview} alt="" className="max-h-56 w-full rounded-2xl object-cover" />
      ) : null}
      {visualKind === "video" && visualPreview ? (
        <video src={visualPreview} controls className="w-full rounded-2xl" />
      ) : null}
      {audioPreview ? <audio src={audioPreview} controls className="w-full" /> : null}

      {(visual || audio) && !rec ? (
        <div className="flex gap-2">
          {visual ? (
            <button
              type="button"
              onClick={() => {
                if (visualPreview) URL.revokeObjectURL(visualPreview);
                setVisual(null);
                setVisualPreview("");
                setVisualKind("none");
              }}
              className="flex-1 rounded-xl bg-stone-100 py-2 text-sm font-bold text-stone-700"
            >
              फोटो हटाएं
            </button>
          ) : null}
          {audio ? (
            <button
              type="button"
              onClick={() => {
                if (audioPreview) URL.revokeObjectURL(audioPreview);
                setAudio(null);
                setAudioPreview("");
              }}
              className="flex-1 rounded-xl bg-stone-100 py-2 text-sm font-bold text-stone-700"
            >
              आवाज़ हटाएं
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="font-semibold text-red-800">{error}</p> : null}

      <button
        disabled={busy}
        className="min-h-16 w-full rounded-2xl bg-teal-800 text-xl font-black text-white disabled:opacity-50"
      >
        {busy ? "भेज रहे हैं…" : "गाँव को भेजें"}
      </button>
    </form>
  );
}
