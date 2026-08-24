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

export function skillByKey(key) {
  return SKILLS.find((s) => s.key === key) || SKILLS[SKILLS.length - 1];
}

export function formatRupees(paise) {
  if (!paise) return "";
  return new Intl.NumberFormat("hi-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function rupeesToPaise(rupees) {
  return Math.round(rupees * 100);
}
