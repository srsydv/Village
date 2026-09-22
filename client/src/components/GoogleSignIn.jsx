import { useEffect, useRef, useState } from "react";
import { fetchAuthConfig, signInWithGoogleCredential } from "../lib/api.js";

let gisPromise;

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

export function GoogleSignIn({ onSignedIn }) {
  const slot = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchAuthConfig();
        if (!config.enabled || !config.googleClientId) {
          if (!cancelled) setError("Google Sign-In is not configured on the server.");
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

  return (
    <div>
      <div ref={slot} className="flex min-h-11 justify-center" />
      {!ready && !error && <p className="mt-2 text-center text-xs text-[var(--muted)]">Loading Google…</p>}
      {error && <p className="mt-2 text-center text-xs text-[var(--rose)]">{error}</p>}
    </div>
  );
}
