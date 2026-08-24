const UA = "VillageNews/1.0 (rural community app)";

function cleanPlaceName(name) {
  return String(name || "")
    .replace(/\*+/g, "")
    .replace(/\s+(B\.?O\.?|S\.?O\.?|H\.?O\.?|G\.?P\.?O\.?)$/i, "")
    .replace(/\s+(Branch|Sub|Head)\s+Post\s+Office$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNames(names) {
  const seen = new Set();
  const out = [];
  for (const raw of names) {
    const name = cleanPlaceName(raw);
    if (!name) continue;
    const key = name.toLocaleLowerCase("en-IN");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export async function lookupPincode(pincode) {
  const pin = String(pincode || "").replace(/\D/g, "").slice(0, 6);
  if (!/^\d{6}$/.test(pin)) {
    throw new Error("पिन कोड 6 अंकों का होना चाहिए");
  }
  const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("पिन कोड सेवा नहीं चली");
  const data = await res.json();
  const block = Array.isArray(data) ? data[0] : null;
  if (!block || block.Status !== "Success" || !block.PostOffice?.length) {
    throw new Error("यह पिन कोड नहीं मिला");
  }
  const offices = block.PostOffice.map((po) => ({
    name: cleanPlaceName(po.Name),
    branchType: po.BranchType,
    delivery: po.DeliveryStatus,
    district: po.District,
    state: po.State,
    block: cleanPlaceName(po.Block) || "",
    division: po.Division,
    region: po.Region,
    pincode: po.Pincode,
  }));
  const first = offices[0];
  return {
    pincode: pin,
    state: first.state,
    district: first.district,
    postOffices: offices,
    /** India Post locality / BO names under this PIN (gov API). */
    villages: uniqueNames(offices.map((o) => o.name)),
  };
}

/**
 * Villages for a PIN + selected post office.
 * Source 1: India Post (api.postalpincode.in) — BO/SO names & same Block
 * Source 2: OpenStreetMap around the PIN centroid (extra nearby places)
 */
export async function listVillages({ pincode, postOffice }) {
  const postal = await lookupPincode(pincode);
  const selectedName = cleanPlaceName(postOffice);
  const selected =
    postal.postOffices.find(
      (o) => o.name.toLocaleLowerCase("en-IN") === selectedName.toLocaleLowerCase("en-IN"),
    ) || null;

  let fromPost = postal.postOffices;
  if (selected?.block) {
    const sameBlock = postal.postOffices.filter(
      (o) => o.block && o.block.toLocaleLowerCase("en-IN") === selected.block.toLocaleLowerCase("en-IN"),
    );
    if (sameBlock.length) fromPost = sameBlock;
  } else if (selected) {
    fromPost = [selected, ...postal.postOffices.filter((o) => o.name !== selected.name)];
  }

  const names = fromPost.map((o) => o.name);
  if (selected) names.unshift(selected.name);

  let osmVillages = [];
  try {
    osmVillages = await nearbyOsmVillages(postal.pincode, selected?.name || postal.district);
  } catch {
    osmVillages = [];
  }

  const villages = uniqueNames([...names, ...osmVillages]);
  return {
    pincode: postal.pincode,
    state: postal.state,
    district: postal.district,
    postOffice: selected?.name || selectedName || "",
    block: selected?.block || "",
    source: "India Post (api.postalpincode.in) + OpenStreetMap",
    villages,
  };
}

async function geocodePincode(pincode) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "in");
  url.searchParams.set("limit", "1");
  url.searchParams.set("postalcode", String(pincode));
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;
  return { lat: Number(hit.lat), lon: Number(hit.lon) };
}

async function nearbyOsmVillages(pincode, hintName) {
  const point = await geocodePincode(pincode);
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
    return [];
  }

  const query = `
[out:json][timeout:20];
(
  node["place"~"village|hamlet|suburb|locality|town"](around:10000,${point.lat},${point.lon});
  way["place"~"village|hamlet|suburb|locality|town"](around:10000,${point.lat},${point.lon});
);
out center tags 60;
`.trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "text/plain" },
      body: query,
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const names = (data.elements || [])
      .map((el) => el.tags?.name)
      .filter(Boolean);
    if (hintName) names.unshift(hintName);
    return uniqueNames(names);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function reverseGeocode(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    throw new Error("स्थान गलत है");
  }
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(la));
  url.searchParams.set("lon", String(ln));
  url.searchParams.set("zoom", "14");
  url.searchParams.set("addressdetails", "1");
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error("मानचित्र सेवा नहीं चली");
  const data = await res.json();
  const addr = data.address || {};
  const pin = String(addr.postcode || "").replace(/\D/g, "").slice(0, 6);
  let postal = null;
  if (/^\d{6}$/.test(pin)) {
    try {
      postal = await lookupPincode(pin);
    } catch {
      postal = null;
    }
  }
  const villageGuess = cleanPlaceName(
    addr.village || addr.hamlet || addr.suburb || addr.town || "",
  );
  return {
    lat: la,
    lng: ln,
    displayName: data.display_name || "",
    villageGuess,
    pincode: pin || postal?.pincode || "",
    state: postal?.state || addr.state || "",
    district: postal?.district || addr.county || addr.state_district || "",
    postOffices: postal?.postOffices || [],
    villages: uniqueNames([...(postal?.villages || []), villageGuess]),
  };
}
