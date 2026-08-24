import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authHeaders } from "../../lib/news/session.js";
import { useNews } from "./NewsProvider.jsx";

export function ComposePost() {
  const { token, user, t, te } = useNews();
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
      stream.getTracks().forEach((track) => track.stop());
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
      setError(t("needMedia"));
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
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(t("serverDown"));
      }
      if (!res.ok) throw new Error(data.error || t("postFailed"));
      navigate("/news");
    } catch (err) {
      setError(te(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="kicker">COMPOSE</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[var(--ink)]">{t("composeTitle")}</h1>
        <p className="mt-1 text-sm font-semibold text-stone-500">
          {user.villageName} · {user.pincode} {t("composeOn")}
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={t("composePlaceholder")}
        className="input-field min-h-32 py-4"
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="card flex min-h-16 items-center justify-center rounded-2xl font-bold">
          {t("photoVideo")}
          <input type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={onFile} />
        </label>
        {rec ? (
          <button type="button" onClick={() => rec.stop()} className="min-h-16 rounded-2xl bg-red-700 font-bold text-white">
            {t("stop")}
          </button>
        ) : (
          <button type="button" onClick={() => void startVoice()} className="min-h-16 rounded-2xl bg-[var(--ink)] font-bold text-white">
            {audio ? t("changeVoice") : t("voice")}
          </button>
        )}
      </div>
      <p className="text-center text-sm font-semibold text-stone-400">{t("bothMedia")}</p>

      {visualKind === "image" && visualPreview ? (
        <img src={visualPreview} alt="" className="max-h-56 w-full rounded-2xl object-cover" />
      ) : null}
      {visualKind === "video" && visualPreview ? <video src={visualPreview} controls className="w-full rounded-2xl" /> : null}
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
              className="flex-1 rounded-xl bg-black/5 py-2 text-sm font-bold text-stone-700"
            >
              {t("removePhoto")}
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
              className="flex-1 rounded-xl bg-black/5 py-2 text-sm font-bold text-stone-700"
            >
              {t("removeAudio")}
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="font-semibold text-red-800">{error}</p> : null}

      <button disabled={busy} className="btn-primary min-h-16 w-full rounded-2xl text-xl font-extrabold disabled:opacity-50">
        {busy ? t("sending") : t("sendVillage")}
      </button>
    </form>
  );
}
