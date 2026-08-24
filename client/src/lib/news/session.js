const KEY = "news_session";

export function saveNewsSession(session) {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function loadNewsSession() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearNewsSession() {
  localStorage.removeItem(KEY);
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}
