let region = "";
let allowed = false;
let pending;

export function currentRegion() {
  return region;
}

export function geminiAllowed() {
  return allowed;
}

export function allowGemini(next) {
  allowed = Boolean(next);
}

const INDIA = [
  [32.6, 74.8],
  [35.4, 77.0],
  [34.0, 78.8],
  [31.0, 79.0],
  [28.5, 81.0],
  [27.4, 88.1],
  [26.6, 88.6],
  [26.2, 89.8],
  [25.3, 91.8],
  [27.5, 95.5],
  [28.2, 97.0],
  [27.0, 96.0],
  [25.5, 94.5],
  [24.2, 94.3],
  [22.4, 93.0],
  [21.8, 92.4],
  [22.0, 88.5],
  [21.5, 86.9],
  [19.3, 84.8],
  [17.0, 82.3],
  [13.1, 80.3],
  [8.08, 77.55],
  [8.3, 76.9],
  [12.0, 75.0],
  [15.4, 73.8],
  [18.9, 72.8],
  [21.0, 72.6],
  [22.7, 68.4],
  [23.8, 68.3],
  [28.5, 70.2],
];

function insideIndia(lat, lng) {
  let inside = false;
  for (let i = 0, j = INDIA.length - 1; i < INDIA.length; j = i++) {
    const [latI, lngI] = INDIA[i];
    const [latJ, lngJ] = INDIA[j];
    const crosses = latI > lat !== latJ > lat;
    const edge = ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (crosses && lng < edge) inside = !inside;
  }
  return inside;
}

async function countryCode(lat, lng) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&localityLanguage=en`;
    const http = window.Capacitor?.Plugins?.CapacitorHttp;
    let data = null;
    if (http?.get) {
      const result = await http.get({ url });
      if (result.status >= 200 && result.status < 300) {
        data = typeof result.data === "string" ? JSON.parse(result.data) : result.data;
      }
    } else {
      const res = await fetch(url);
      if (res.ok) data = await res.json();
    }
    const code = String(data?.countryCode || "").toUpperCase();
    if (code) return code === "IN" ? "IN" : "OTHER";
  } catch {
    // The phone's coordinates still decide India when the country lookup fails.
  }
  return insideIndia(lat, lng) ? "IN" : "OTHER";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilVisible() {
  const app = window.Capacitor?.Plugins?.App;
  try {
    const state = await app?.getState?.();
    if (state?.isActive) {
      await delay(700);
      return;
    }
  } catch {
    // The prompt still waits below so it is not covered by the splash screen.
  }
  await delay(900);
}

async function nativeGeo() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const geo = window.Capacitor?.Plugins?.Geolocation;
    if (geo?.getCurrentPosition) return geo;
    if (!window.Capacitor?.isNativePlatform?.()) return null;
    await delay(150);
  }
  return null;
}

async function readPosition() {
  const geo = await nativeGeo();
  if (geo?.getCurrentPosition) {
    await waitUntilVisible();
    try {
      await geo.requestPermissions({ permissions: ["location"] });
    } catch {
      // getCurrentPosition shows the same system prompt if that call was skipped.
    }
    return geo.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 5 * 60 * 1000 });
  }
  if (!navigator.geolocation) throw new Error("This phone cannot share location.");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 10 * 60 * 1000,
    });
  });
}

function placeFrom(pos) {
  const latitude = Number(pos?.coords?.latitude);
  const longitude = Number(pos?.coords?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Safar could not read this location.");
  }
  return { latitude, longitude };
}

export function beginLocationRequest() {
  const native = window.Capacitor?.isNativePlatform?.() ? window.Capacitor?.Plugins?.Geolocation : null;
  if (native?.getCurrentPosition) {
    return (async () => {
      try {
        await native.requestPermissions({ permissions: ["location"] });
      } catch {
        // getCurrentPosition shows the same system prompt if that call was skipped.
      }
      return placeFrom(await native.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }));
    })();
  }
  if (!navigator.geolocation) {
    return Promise.reject(new Error("This browser cannot share location."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          resolve(placeFrom(pos));
        } catch (err) {
          reject(err);
        }
      },
      reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 },
    );
  });
}

export async function currentPosition() {
  return beginLocationRequest();
}

async function resolveRegion() {
  try {
    const pos = await readPosition();
    const lat = pos?.coords?.latitude;
    const lng = pos?.coords?.longitude;
    region = Number.isFinite(lat) && Number.isFinite(lng) ? await countryCode(lat, lng) : "OTHER";
  } catch {
    region = "OTHER";
  }
  if (region === "IN") allowed = true;
  return region;
}

export function detectRegion() {
  if (!pending) pending = resolveRegion();
  return pending;
}
