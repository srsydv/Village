export function formatPhone(digits) {
  const d = String(digits || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("91") && d.length === 12) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return `+${d}`;
}
