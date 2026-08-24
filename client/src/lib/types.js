export const AVATARS = [
  { key: "sun", emoji: "☀️", label: "सूरज" },
  { key: "leaf", emoji: "🍃", label: "पत्ता" },
  { key: "flower", emoji: "🌸", label: "फूल" },
  { key: "bird", emoji: "🕊️", label: "पंछी" },
  { key: "pot", emoji: "🏺", label: "मटका" },
  { key: "tree", emoji: "🌳", label: "पेड़" },
  { key: "star", emoji: "⭐", label: "तारा" },
  { key: "lotus", emoji: "🪷", label: "कमल" },
];

export function formatRupees(paise) {
  const rupees = paise / 100;
  return new Intl.NumberFormat("hi-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

export function rupeesToPaise(rupees) {
  return Math.round(rupees * 100);
}
