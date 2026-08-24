export const SKILLS = [
  { key: "mechanic", emoji: "🔧", label: "मिस्त्री" },
  { key: "electrician", emoji: "💡", label: "बिजली" },
  { key: "plumber", emoji: "🚰", label: "नल" },
  { key: "mason", emoji: "🧱", label: "राजमिस्त्री" },
  { key: "labor", emoji: "💪", label: "मजदूर" },
  { key: "tailor", emoji: "🧵", label: "दर्जी" },
  { key: "tractor", emoji: "🚜", label: "ट्रैक्टर" },
  { key: "other", emoji: "🛠️", label: "और काम" },
];

export const JOB_STATUSES = ["open", "claimed", "done"];

export function skillLabel(key) {
  return SKILLS.find((s) => s.key === key)?.label || "काम";
}

export function skillEmoji(key) {
  return SKILLS.find((s) => s.key === key)?.emoji || "🛠️";
}
