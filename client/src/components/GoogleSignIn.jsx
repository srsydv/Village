import { useEffect, useRef, useState } from "react";
import { fetchAuthConfig, signInWithGoogleCredential } from "../lib/api.js";

let gisPromise;

function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function nativeGoogle() {
  return window.Capacitor?.Plugins?.GoogleSignIn || null;
}

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-safar-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Google Sign-In.")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.safarGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Sign-In."));
    document.head.appendChild(script);
  });
  return gisPromise;
}

function signInError(err) {
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  if (code.includes("CANCELED") || /cancel/i.test(message)) return "Sign-in was cancelled.";
  if (code.includes("NO_CREDENTIAL") || /no google account/i.test(message)) {
    return "Add a Google account on this phone, then try again.";
  }
  if (/reauth|UNREGISTERED|Api Console|10\b/i.test(message + code)) {
    return "This Android app is not registered in Google Cloud. Add an Android OAuth client for com.safar.travel.";
  }
  return message || "Google sign-in failed.";
}

export function GoogleSignIn({ onSignedIn }) {
  const slot = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [native, setNative] = useState(false);
  const clientId = useRef("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchAuthConfig();
        if (cancelled) return;
        if (typeof config.enabled !== "boolean") {
          setError("Could not reach the Safar server. Check your connection.");
          return;
        }
        if (!config.enabled || !config.googleClientId) {
          setError("Google Sign-In is not configured on the server.");
          return;
        }
        clientId.current = config.googleClientId;

        if (isNativeApp()) {
          const plugin = nativeGoogle();
          if (!plugin) {
            setError("Google Sign-In is missing from this app build.");
            return;
          }
          await plugin.initialize({ clientId: config.googleClientId });
          if (!cancelled) {
            setNative(true);
            setReady(true);
          }
          return;
        }

        await loadGis();
        if (cancelled || !slot.current || !window.google?.accounts?.id) return;
        slot.current.innerHTML = "";
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async (response) => {
            setError("");
            try {
              const data = await signInWithGoogleCredential(response.credential);
              onSignedIn(data);
            } catch (err) {
              setError(err.message || "Google sign-in failed.");
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: false,
        });
        window.google.accounts.id.renderButton(slot.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(slot.current.parentElement?.clientWidth || 320, 400),
        });
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err.message || "Google Sign-In could not start.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onSignedIn]);

  async function onNativeClick() {
    const plugin = nativeGoogle();
    if (!plugin || busy) return;
    setBusy(true);
    setError("");
    try {
      if (clientId.current) {
        await plugin.initialize({ clientId: clientId.current });
      }
      const result = await plugin.signIn();
      if (!result?.idToken) throw new Error("Google did not return a sign-in token.");
      const data = await signInWithGoogleCredential(result.idToken);
      onSignedIn(data);
    } catch (err) {
      setError(signInError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {native ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-3 rounded-full bg-black py-3.5 text-sm font-medium text-white"
          disabled={busy || !ready}
          onClick={onNativeClick}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A8.99 8.99 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.69 9c0-.59.1-1.17.28-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A8.99 8.99 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
          </svg>
          {busy ? "Signing in…" : "Continue with Google"}
        </button>
      ) : (
        <div ref={slot} className="flex min-h-11 justify-center" />
      )}
      {!ready && !error && <p className="mt-2 text-center text-xs text-[var(--muted)]">Loading Google…</p>}
      {error && <p className="mt-2 text-center text-xs text-[var(--rose)]">{error}</p>}
    </div>
  );
}
