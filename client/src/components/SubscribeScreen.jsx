import { useEffect, useState } from "react";
import { verifyPlayPurchase } from "../lib/api.js";
import { useAccess } from "../lib/access.jsx";
import { useTravel } from "../lib/TravelContext.jsx";
import { GoogleSignIn } from "./GoogleSignIn.jsx";

const FALLBACK = [
  { productId: "safar_monthly", title: "Monthly", price: "$10 / month" },
  { productId: "safar_yearly", title: "Yearly", price: "$100 / year" },
];

function nativeBilling() {
  return window.Capacitor?.isNativePlatform?.() ? window.Capacitor?.Plugins?.PlayBilling : null;
}

export function SubscribeScreen() {
  const { signedIn, completeGoogleSignIn } = useTravel();
  const { setSubscription } = useAccess();
  const [plans, setPlans] = useState(FALLBACK);
  const [error, setError] = useState("");
  const [buying, setBuying] = useState("");

  useEffect(() => {
    const billing = nativeBilling();
    if (!billing?.products) return undefined;
    let cancel = false;
    billing.products()
      .then((result) => {
        const rows = Array.isArray(result?.products) ? result.products : [];
        if (!cancel && rows.length) {
          setPlans(rows.map((row) => ({
            productId: row.productId,
            title: row.productId === "safar_yearly" ? "Yearly" : "Monthly",
            price: row.price,
          })));
        }
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  const buy = async (productId) => {
    const billing = nativeBilling();
    if (!billing?.purchase) {
      setError("Open Safar on Android to subscribe.");
      return;
    }
    setBuying(productId);
    setError("");
    try {
      const purchase = await billing.purchase({ productId });
      const status = await verifyPlayPurchase(purchase);
      setSubscription(status.subscription || null);
    } catch (err) {
      if (!String(err?.message || "").toLowerCase().includes("cancel")) {
        setError(err.message || "The subscription could not be completed.");
      }
    } finally {
      setBuying("");
    }
  };

  return (
    <div className="px-5 pt-8 pb-10">
      <p className="kicker">Safar</p>
      <h1 className="serif mt-2 text-[2.2rem] leading-tight font-semibold">Plan and ask with Safar</h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
        Outside India, a subscription covers trip plans and questions. The home screen stays open either way.
        If you are in India, allow location when Android asks. Plan and Ask stay free there.
      </p>
      {!signedIn ? (
        <div className="mt-6">
          <GoogleSignIn onSignedIn={completeGoogleSignIn} />
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {plans.map((plan) => (
            <button
              key={plan.productId}
              type="button"
              className="btn-gold rounded-2xl px-4 py-4 text-left disabled:opacity-60"
              disabled={Boolean(buying)}
              onClick={() => buy(plan.productId)}
            >
              <span className="block text-xs font-semibold tracking-wide uppercase">{plan.title}</span>
              <span className="mt-1 block text-lg font-semibold">{buying === plan.productId ? "Opening Google Play…" : plan.price}</span>
            </button>
          ))}
        </div>
      )}
      {error ? <p className="mt-4 text-sm text-[var(--rose)]">{error}</p> : null}
    </div>
  );
}

export function GeminiGate({ children }) {
  const { ready, entitled } = useAccess();
  if (!ready) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <p className="kicker">Safar</p>
      </div>
    );
  }
  if (!entitled) return <SubscribeScreen />;
  return children;
}
