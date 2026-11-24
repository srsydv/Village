const AIRPORTS = {
  delhi: "DEL",
  "new delhi": "DEL",
  "delhi airport": "DEL",
  mumbai: "BOM",
  bombay: "BOM",
  bangalore: "BLR",
  bengaluru: "BLR",
  hyderabad: "HYD",
  chennai: "MAA",
  madras: "MAA",
  kolkata: "CCU",
  calcutta: "CCU",
  goa: "GOI",
  jaipur: "JAI",
  ahmedabad: "AMD",
  pune: "PNQ",
  lucknow: "LKO",
  varanasi: "VNS",
  banaras: "VNS",
  kashi: "VNS",
  amritsar: "ATQ",
  chandigarh: "IXC",
  kochi: "COK",
  cochin: "COK",
  thiruvananthapuram: "TRV",
  trivandrum: "TRV",
  srinagar: "SXR",
  udaipur: "UDR",
  jodhpur: "JDH",
  indore: "IDR",
  bhopal: "BHO",
  patna: "PAT",
  ranchi: "IXR",
  guwahati: "GAU",
  bhubaneswar: "BBI",
  visakhapatnam: "VTZ",
  vizag: "VTZ",
  nagpur: "NAG",
  surat: "STV",
  vadodara: "BDQ",
  coimbatore: "CJB",
  madurai: "IXM",
  mangalore: "IXE",
  mangaluru: "IXE",
  bagdogra: "IXB",
  dehradun: "DED",
  leh: "IXL",
  portblair: "IXZ",
  "port blair": "IXZ",
  agra: "AGR",
  dubai: "DXB",
  "abu dhabi": "AUH",
  doha: "DOH",
  singapore: "SIN",
  bangkok: "BKK",
  london: "LHR",
  paris: "CDG",
  "new york": "JFK",
  nyc: "JFK",
  kathmandu: "KTM",
  colombo: "CMB",
  male: "MLE",
  maldives: "MLE",
  bali: "DPS",
  denpasar: "DPS",
  "kuala lumpur": "KUL",
  istanbul: "IST",
  rome: "FCO",
  barcelona: "BCN",
  amsterdam: "AMS",
  frankfurt: "FRA",
  tokyo: "NRT",
  seoul: "ICN",
  sydney: "SYD",
  melbourne: "MEL",
  toronto: "YYZ",
  "san francisco": "SFO",
  "los angeles": "LAX",
  "indira gandhi": "DEL",
  "igi airport": "DEL",
  palam: "DEL",
  "lal bahadur shastri": "VNS",
  babatpur: "VNS",
  "chatrapati shivaji": "BOM",
  "chhatrapati shivaji": "BOM",
  sahar: "BOM",
  "kempegowda": "BLR",
  "rajiv gandhi": "HYD",
  "netaji subhas": "CCU",
  "sardar vallabhbhai": "AMD",
  "lokpriya gopinath": "GAU",
  "lal bahadur": "VNS",
};

const KNOWN_CODES = new Set(Object.values(AIRPORTS));

const TYPOS = [
  [/b[ae]ng[aeu]?l[ou]+r[ua]+|banglore|bangalor|blr\b/g, " bengaluru "],
  [/benares|banaras|varanasi|kashi/g, " varanasi "],
  [/newdelhi|dilli|dehli/g, " delhi "],
  [/bombay|mumbai/g, " mumbai "],
  [/calcutta|kolkata/g, " kolkata "],
  [/madras|chennai/g, " chennai "],
  [/trivandrum/g, " thiruvananthapuram "],
  [/vizag/g, " visakhapatnam "],
  [/cochin/g, " kochi "],
];

function normPlace(place) {
  let key = String(place || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const [pattern, city] of TYPOS) key = key.replace(pattern, city);
  return key.replace(/\s+/g, " ").trim();
}

function editDistance(left, right) {
  if (Math.abs(left.length - right.length) > 2) return 9;
  const row = Array(right.length + 1).fill(0).map((_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = i - 1;
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const current = row[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min(previous + cost, row[j] + 1, row[j - 1] + 1);
      previous = current;
    }
  }
  return row[right.length];
}

export function airportCode(place) {
  const key = normPlace(place);
  if (!key) return "";
  if (/^[a-z]{3}$/.test(key) && KNOWN_CODES.has(key.toUpperCase())) return key.toUpperCase();
  if (AIRPORTS[key]) return AIRPORTS[key];
  const names = Object.keys(AIRPORTS).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(key)) return AIRPORTS[name];
  }
  const words = key.split(" ").filter((word) => word.length >= 5);
  let best = "";
  let bestDistance = 3;
  for (const word of words) {
    for (const name of names) {
      if (name.includes(" ")) continue;
      const distance = editDistance(word, name);
      if (distance < bestDistance) {
        best = AIRPORTS[name];
        bestDistance = distance;
      }
    }
  }
  return bestDistance <= 2 ? best : "";
}

export function airportsIn(text) {
  const key = normPlace(text);
  if (!key) return [];
  const names = Object.keys(AIRPORTS).sort((a, b) => b.length - a.length);
  const hits = [];
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "g");
    let match;
    while ((match = re.exec(key))) {
      const start = match.index + (key[match.index] === " " ? 1 : 0);
      const end = start + name.length;
      if (hits.some((hit) => start < hit.end && end > hit.start)) continue;
      hits.push({ start, end, code: AIRPORTS[name] });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const codes = [];
  for (const hit of hits) {
    if (codes[codes.length - 1] !== hit.code) codes.push(hit.code);
  }
  return codes;
}
