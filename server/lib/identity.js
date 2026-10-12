const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
  if (!raw) return "";
  if (!USERNAME_RE.test(raw)) {
    const err = new Error("Usernames are 3–20 letters, numbers, or underscores.");
    err.status = 400;
    throw err;
  }
  return raw;
}

export function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) {
    const err = new Error("Enter a phone number with country code, or 10 digits for India.");
    err.status = 400;
    throw err;
  }
  return digits;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function emailQuery(email) {
  return { email: { $regex: `^${escapeRegex(String(email || "").trim())}$`, $options: "i" } };
}

export function classifyLookup(query) {
  const raw = String(query || "").trim();
  if (!raw) {
    const err = new Error("Type a username, email, or phone number.");
    err.status = 400;
    throw err;
  }
  if (raw.includes("@") && raw.includes(".")) {
    return { kind: "email", value: raw.toLowerCase() };
  }
  const compact = raw.replace(/[\s().-]/g, "");
  const digits = compact.replace(/\D/g, "");
  const rest = compact.replace(/^\+/, "");
  if (digits.length >= 8 && digits === rest) {
    try {
      return { kind: "phone", value: normalizePhone(raw) };
    } catch {
      return { kind: "phone", value: "" };
    }
  }
  try {
    return { kind: "username", value: normalizeUsername(raw) };
  } catch {
    return { kind: "username", value: "" };
  }
}
