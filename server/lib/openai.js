import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const UPLOAD_DIR = path.join(ROOT_DIR, ".data", "uploads", "news");

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

export async function mediaToDataUrl(mediaUrl) {
  if (!mediaUrl) return "";
  if (String(mediaUrl).startsWith("data:")) return mediaUrl;
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;
  const name = path.basename(String(mediaUrl).split("?")[0]);
  if (!name || name.includes("..")) return "";
  const filePath = path.join(UPLOAD_DIR, name);
  try {
    const buf = await fs.readFile(filePath);
    if (buf.length > 4 * 1024 * 1024) return "";
    const mime = mimeFromExt(filePath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function chatCompletion({ messages, maxTokens = 500 }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const err = new Error("OpenAI key missing");
    err.status = 503;
    throw err;
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || "AI reply failed");
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502;
    throw err;
  }
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    const err = new Error("Empty AI reply");
    err.status = 502;
    throw err;
  }
  return text;
}

export async function askAboutPost({ question, post, lang }) {
  const q = String(question || "").trim().slice(0, 500);
  if (q.length < 2) {
    const err = new Error("सवाल लिखें");
    err.status = 400;
    throw err;
  }
  const hindi = lang !== "en";
  const imageUrl =
    post.mediaType === "image" && post.mediaUrl ? await mediaToDataUrl(post.mediaUrl) : "";

  const system = hindi
    ? "आप Village ऐप के सहायक हैं। गाँव की खबर/फोटो के बारे में सरल, सही और विनम्र हिंदी में जवाब दें। अगर पता न हो तो साफ कहें। खतरनाक सलाह न दें।"
    : "You are the Village app assistant. Answer simply and politely about the village post/photo. If unsure, say so. Do not give dangerous advice.";

  const context = [
    `Author: ${post.authorName || ""}`,
    `Village: ${post.villageName || ""}`,
    `Text: ${post.text || "(no text)"}`,
    post.mediaType && post.mediaType !== "none" ? `Media: ${post.mediaType}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userContent = imageUrl
    ? [
        { type: "text", text: `Post context:\n${context}\n\nUser question: ${q}` },
        { type: "image_url", image_url: { url: imageUrl } },
      ]
    : `Post context:\n${context}\n\nUser question: ${q}`;

  return chatCompletion({
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
    maxTokens: 450,
  });
}

export async function suggestChatReply({ lastMessages, peerName, lang }) {
  const hindi = lang !== "en";
  const history = (lastMessages || [])
    .slice(-8)
    .map((m) => `${m.fromName || "User"}: ${m.text || (m.sharedPost ? "[shared post]" : m.mediaType === "image" ? "[photo]" : m.audioUrl ? "[voice]" : "")}`)
    .join("\n");
  const system = hindi
    ? "आप Village चैट सहायक हैं। एक छोटा, विनम्र उत्तर सुझाएँ जिसे यूज़र भेज सके। सिर्फ जवाब का टेक्स्ट दें, कोई भूमिका या कोट न लिखें।"
    : "You are a Village chat assistant. Suggest one short polite reply the user can send. Return only the reply text.";
  return chatCompletion({
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Chat with: ${peerName || "friend"}\nRecent messages:\n${history || "(none)"}\n\nSuggest a reply.`,
      },
    ],
    maxTokens: 120,
  });
}
