import { GoogleAuth } from "google-auth-library";

const PACKAGE_NAME = "com.safartravel.app";
const PRODUCTS = new Set(["safar_monthly", "safar_yearly"]);

let auth;

function credentials() {
  const raw = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) return null;
  if (raw.startsWith("{")) return JSON.parse(raw);
  return null;
}

function playAuth() {
  const parsed = credentials();
  const keyFile = String(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_FILE || "").trim();
  if (!parsed && !keyFile) {
    const err = new Error("Play billing is not configured on the server yet.");
    err.status = 503;
    throw err;
  }
  if (!auth) {
    auth = new GoogleAuth({
      credentials: parsed || undefined,
      keyFile: parsed ? undefined : keyFile,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
  }
  return auth;
}

export function isPlayProduct(productId) {
  return PRODUCTS.has(String(productId || ""));
}

export async function verifyPlaySubscription(productId, token) {
  if (!isPlayProduct(productId) || !token) {
    const err = new Error("This purchase could not be checked.");
    err.status = 400;
    throw err;
  }
  const client = await playAuth().getClient();
  const encoded = encodeURIComponent(token);
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encoded}`;
  const res = await client.request({ url });
  const body = res.data || {};
  const line = (body.lineItems || []).find((item) => item.productId === productId) || body.lineItems?.[0];
  const state = String(body.subscriptionState || "");
  const expiresAt = line?.expiryTime || "";
  const expiryMs = Date.parse(expiresAt);
  const entitled = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "SUBSCRIPTION_STATE_CANCELED"].includes(state)
    && Number.isFinite(expiryMs)
    && expiryMs > Date.now();
  if (!entitled) {
    const err = new Error("This subscription is not active.");
    err.status = 402;
    throw err;
  }
  if (body.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
    const ack = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encoded}:acknowledge`;
    await client.request({ url: ack, method: "POST", data: {} }).catch(() => {});
  }
  return {
    productId,
    purchaseToken: token,
    expiresAt: new Date(expiryMs).toISOString(),
    state: state === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD" ? "grace" : "active",
  };
}
