export function smsHref(phone, body) {
  const digits = String(phone || "").replace(/\D/g, "");
  const target = digits ? `sms:${digits}` : "sms:";
  return `${target}?body=${encodeURIComponent(body)}`;
}

export function telHref(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `tel:+91${digits}` : `tel:${digits}`;
}

export async function shareOrSms(title, text, phone = "") {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return "share";
    } catch (err) {
      if (err && err.name === "AbortError") return "cancel";
    }
  }
  if (typeof window !== "undefined") {
    window.location.href = smsHref(phone, text);
    return "sms";
  }
  return "none";
}

export function jobShareText({ villageName, posterName, skillLabel, payRupees, code }) {
  const pay = payRupees ? ` मज़दूरी ₹${payRupees}.` : "";
  return `ग्रामसेवा: ${villageName} में ${posterName} को ${skillLabel} चाहिए.${pay} गाँव कोड ${code}`;
}

export function workerShareText({ villageName, displayName, skillLabel, phone, code }) {
  const ph = phone ? ` फोन ${phone}.` : "";
  return `ग्रामसेवा: ${villageName} — ${displayName} (${skillLabel}).${ph} गाँव कोड ${code}`;
}
