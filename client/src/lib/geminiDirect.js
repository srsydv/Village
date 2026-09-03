const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const MODEL_FALLBACKS = [
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
];

export function hasDirectGemini() {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

function apiKey() {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error("Gemini is not configured in this app build.");
  return key;
}

function modelsToTry() {
  const preferred = import.meta.env.VITE_GEMINI_MODEL;
  const list = preferred ? [preferred, ...MODEL_FALLBACKS] : MODEL_FALLBACKS;
  return [...new Set(list.filter(Boolean))];
}

function toGeminiContents(messages) {
  return messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }],
    }));
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p.text || "").join("");
}

function payload({ messages, system, json = false }) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature: json ? 0.6 : 0.85,
      maxOutputTokens: 4096,
      ...(json ? { responseMimeType: "application/json" } : {}),
    },
  };
}

function friendlyGeminiError(status, body) {
  if (status === 401 || status === 403) return "Gemini rejected the API key.";
  if (status === 429) return "Aurea is busy right now. Please wait a moment and try again.";
  if (status === 404) return "That Gemini model is not available on this key.";
  return `Gemini error (${status}): ${String(body).slice(0, 180)}`;
}

export async function generateDirect({ messages, system, json = false }) {
  let lastError;
  for (const model of modelsToTry()) {
    const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey(),
      },
      body: JSON.stringify(payload({ messages, system, json })),
    });
    if (res.ok) {
      const data = await res.json();
      const text = extractText(data).trim();
      if (!text) {
        lastError = new Error("Aurea received an empty reply. Please try again.");
        continue;
      }
      return { text, model };
    }
    const errBody = await res.text();
    lastError = new Error(friendlyGeminiError(res.status, errBody));
    if (res.status === 404 || res.status === 400 || res.status === 429 || res.status === 503) continue;
    break;
  }
  throw lastError || new Error("Gemini request failed");
}
