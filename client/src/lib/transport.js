import { formatDay } from "./dates.js";

export const TRANSPORT_MODES = [
  { id: "flight", label: "Flight", line: "Compare airlines" },
  { id: "train", label: "Train", line: "Rail & stations" },
  { id: "bus", label: "Bus", line: "Coach fares" },
];

const MODE_IDS = TRANSPORT_MODES.map((mode) => mode.id);

const EUROPE = new Set([
  "United Kingdom",
  "Ireland",
  "France",
  "Germany",
  "Italy",
  "Spain",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Poland",
  "Czech Republic",
  "Hungary",
  "Greece",
  "Croatia",
]);

const SOUTHEAST_ASIA = new Set([
  "Thailand",
  "Vietnam",
  "Malaysia",
  "Singapore",
  "Indonesia",
  "Cambodia",
  "Laos",
  "Philippines",
  "Myanmar",
]);

const COUNTRY_ALIAS = {
  usa: "United States",
  us: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  britain: "United Kingdom",
  uae: "United Arab Emirates",
  "republic of korea": "South Korea",
  "korea, republic of": "South Korea",
  czechia: "Czech Republic",
  holland: "Netherlands",
};

const SLUG_ALIAS = {
  bengaluru: "bangalore",
  bombay: "mumbai",
  calcutta: "kolkata",
  madras: "chennai",
  "new-delhi": "delhi",
  trivandrum: "thiruvananthapuram",
  gurgaon: "gurugram",
  pondicherry: "puducherry",
  cochin: "kochi",
  baroda: "vadodara",
  benares: "varanasi",
  "new-york": "new-york",
};

/** Main airport, optional Skyscanner metro code, country. */
const AIRPORTS = {
  delhi: ["DEL", "del", "India"],
  mumbai: ["BOM", "", "India"],
  bangalore: ["BLR", "", "India"],
  chennai: ["MAA", "", "India"],
  kolkata: ["CCU", "", "India"],
  hyderabad: ["HYD", "", "India"],
  pune: ["PNQ", "", "India"],
  ahmedabad: ["AMD", "", "India"],
  jaipur: ["JAI", "", "India"],
  lucknow: ["LKO", "", "India"],
  goa: ["GOI", "", "India"],
  kochi: ["COK", "", "India"],
  thiruvananthapuram: ["TRV", "", "India"],
  coimbatore: ["CJB", "", "India"],
  indore: ["IDR", "", "India"],
  bhopal: ["BHO", "", "India"],
  nagpur: ["NAG", "", "India"],
  patna: ["PAT", "", "India"],
  varanasi: ["VNS", "", "India"],
  gorakhpur: ["GOP", "", "India"],
  ayodhya: ["AYJ", "", "India"],
  amritsar: ["ATQ", "", "India"],
  chandigarh: ["IXC", "", "India"],
  udaipur: ["UDR", "", "India"],
  jodhpur: ["JDH", "", "India"],
  srinagar: ["SXR", "", "India"],
  guwahati: ["GAU", "", "India"],
  bhubaneswar: ["BBI", "", "India"],
  visakhapatnam: ["VTZ", "", "India"],
  ranchi: ["IXR", "", "India"],
  raipur: ["RPR", "", "India"],
  surat: ["STV", "", "India"],
  vadodara: ["BDQ", "", "India"],
  dehradun: ["DED", "", "India"],
  madurai: ["IXM", "", "India"],
  mangalore: ["IXE", "", "India"],
  tirupati: ["TIR", "", "India"],
  vijayawada: ["VGA", "", "India"],
  leh: ["IXL", "", "India"],
  portblair: ["IXZ", "", "India"],
  "port-blair": ["IXZ", "", "India"],
  london: ["LHR", "lond", "United Kingdom"],
  manchester: ["MAN", "", "United Kingdom"],
  edinburgh: ["EDI", "", "United Kingdom"],
  paris: ["CDG", "parl", "France"],
  nice: ["NCE", "", "France"],
  lyon: ["LYS", "", "France"],
  berlin: ["BER", "", "Germany"],
  munich: ["MUC", "", "Germany"],
  frankfurt: ["FRA", "", "Germany"],
  rome: ["FCO", "", "Italy"],
  milan: ["MXP", "", "Italy"],
  venice: ["VCE", "", "Italy"],
  madrid: ["MAD", "", "Spain"],
  barcelona: ["BCN", "", "Spain"],
  lisbon: ["LIS", "", "Portugal"],
  amsterdam: ["AMS", "", "Netherlands"],
  brussels: ["BRU", "", "Belgium"],
  zurich: ["ZRH", "", "Switzerland"],
  geneva: ["GVA", "", "Switzerland"],
  vienna: ["VIE", "", "Austria"],
  prague: ["PRG", "", "Czech Republic"],
  dublin: ["DUB", "", "Ireland"],
  "new-york": ["JFK", "nyca", "United States"],
  "los-angeles": ["LAX", "laxa", "United States"],
  "san-francisco": ["SFO", "", "United States"],
  chicago: ["ORD", "chia", "United States"],
  miami: ["MIA", "", "United States"],
  boston: ["BOS", "", "United States"],
  washington: ["IAD", "", "United States"],
  seattle: ["SEA", "", "United States"],
  toronto: ["YYZ", "", "Canada"],
  vancouver: ["YVR", "", "Canada"],
  montreal: ["YUL", "", "Canada"],
  dubai: ["DXB", "", "United Arab Emirates"],
  "abu-dhabi": ["AUH", "", "United Arab Emirates"],
  doha: ["DOH", "", "Qatar"],
  singapore: ["SIN", "", "Singapore"],
  bangkok: ["BKK", "", "Thailand"],
  "chiang-mai": ["CNX", "", "Thailand"],
  phuket: ["HKT", "", "Thailand"],
  "kuala-lumpur": ["KUL", "", "Malaysia"],
  jakarta: ["CGK", "", "Indonesia"],
  bali: ["DPS", "", "Indonesia"],
  hanoi: ["HAN", "", "Vietnam"],
  "ho-chi-minh": ["SGN", "", "Vietnam"],
  saigon: ["SGN", "", "Vietnam"],
  manila: ["MNL", "", "Philippines"],
  tokyo: ["NRT", "tyoa", "Japan"],
  osaka: ["KIX", "", "Japan"],
  seoul: ["ICN", "", "South Korea"],
  "hong-kong": ["HKG", "", "Hong Kong"],
  beijing: ["PEK", "", "China"],
  shanghai: ["PVG", "", "China"],
  sydney: ["SYD", "", "Australia"],
  melbourne: ["MEL", "", "Australia"],
  auckland: ["AKL", "", "New Zealand"],
  colombo: ["CMB", "", "Sri Lanka"],
  kathmandu: ["KTM", "", "Nepal"],
  dhaka: ["DAC", "", "Bangladesh"],
  istanbul: ["IST", "", "Turkey"],
  cairo: ["CAI", "", "Egypt"],
  johannesburg: ["JNB", "", "South Africa"],
  "cape-town": ["CPT", "", "South Africa"],
  "mexico-city": ["MEX", "", "Mexico"],
  "sao-paulo": ["GRU", "", "Brazil"],
};

export function parseModes(value) {
  if (!value) return [...MODE_IDS];
  const picked = String(value)
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((id) => MODE_IDS.includes(id));
  return picked.length ? [...new Set(picked)] : [...MODE_IDS];
}

export function placeTitle(value) {
  return String(value || "")
    .split(",")[0]
    .replace(/\(.*?\)/g, "")
    .trim();
}

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function slug(value) {
  const raw = fold(placeTitle(value))
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return SLUG_ALIAS[raw] || raw;
}

export function normalizeCountry(value) {
  const raw = String(value || "").trim();
  if (!raw || /^other$/i.test(raw)) return "";
  const folded = fold(raw);
  if (COUNTRY_ALIAS[folded]) return COUNTRY_ALIAS[folded];
  const known = new Set([
    ...Object.values(AIRPORTS).map((row) => row[2]),
    ...EUROPE,
    ...SOUTHEAST_ASIA,
    "India",
    "United States",
    "United Kingdom",
    "United Arab Emirates",
    "Canada",
    "Australia",
    "Japan",
    "South Korea",
    "China",
    "Nepal",
    "Bangladesh",
    "Sri Lanka",
    "Pakistan",
    "Qatar",
    "Turkey",
    "Egypt",
    "South Africa",
    "Mexico",
    "Brazil",
    "New Zealand",
    "Hong Kong",
  ]);
  for (const name of known) {
    if (fold(name) === folded) return name;
  }
  return "";
}

function airportOf(value) {
  const key = slug(value);
  const row = AIRPORTS[key];
  if (!row) return null;
  return { iata: row[0], sky: (row[1] || row[0]).toLowerCase(), country: row[2], city: placeTitle(value), nearby: false };
}

/** Cities with no commercial airport, and the airports a search should use instead. */
const NEARBY_AIRPORTS = {
  azamgarh: [
    { iata: "VNS", sky: "vns", city: "Varanasi" },
    { iata: "GOP", sky: "gop", city: "Gorakhpur" },
  ],
  mau: [{ iata: "VNS", sky: "vns", city: "Varanasi" }],
  ballia: [{ iata: "VNS", sky: "vns", city: "Varanasi" }],
  ghazipur: [{ iata: "VNS", sky: "vns", city: "Varanasi" }],
  jaunpur: [{ iata: "VNS", sky: "vns", city: "Varanasi" }],
  faizabad: [{ iata: "AYJ", sky: "ayj", city: "Ayodhya" }],
};

function flightEnds(value) {
  const direct = airportOf(value);
  if (direct) return [direct];
  const nearby = NEARBY_AIRPORTS[slug(value)] || [];
  return nearby.map((airport) => ({ ...airport, country: "India", nearby: true }));
}

export function countryFromLabel(label) {
  const parts = String(label || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const tail = parts.length >= 2 ? normalizeCountry(parts[parts.length - 1]) : "";
  if (tail) return tail;
  return airportOf(parts[0] || label)?.country || "";
}

function countryFromProfile(profile) {
  return normalizeCountry(profile?.nationality) || (profile?.currency === "INR" ? "India" : "");
}

function yymmdd(iso) {
  return String(iso || "").slice(2).replace(/-/g, "");
}

function yyyymmdd(iso) {
  return String(iso || "").replace(/-/g, "");
}

function ddmmyyyy(iso) {
  const [year, month, day] = String(iso || "").split("-");
  if (!year || !month || !day) return "";
  return `${day}${month}${year}`;
}

function redbusDate(iso) {
  const [year, month, day] = String(iso || "").split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const index = Number(month) - 1;
  if (!year || !names[index] || !day) return "";
  return `${Number(day)}-${names[index]}-${year}`;
}

function slashDate(iso) {
  const [year, month, day] = String(iso || "").split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

function googleFlights({ fromLabel, toLabel, date, adults, airline, via }) {
  const count = Math.max(1, Number(adults) || 1);
  const people = ` for ${count} adult${count > 1 ? "s" : ""}`;
  const carrier = airline ? `${airline} ` : "";
  const stop = via ? ` via ${via}` : "";
  const query = `One way ${carrier}flights from ${fromLabel} to ${toLabel} on ${date}${people}${stop}`.replace(/\s+/g, " ").trim();
  return `https://www.google.com/travel/flights/search?q=${encodeURIComponent(query)}`;
}

export function stopLabel(stops) {
  const count = Number(stops);
  if (count === 0) return "Nonstop";
  if (count === 1) return "1 stop";
  if (count === 2) return "2 stops";
  return "";
}

function kayakFlights({ fromCode, toCode, date, adults, india }) {
  const host = india ? "www.kayak.co.in" : "www.kayak.com";
  const pax = Number(adults) > 1 ? `/${adults}adults` : "";
  return `https://${host}/flights/${fromCode}-${toCode}/${date}${pax}?sort=price_a`;
}

function rome2rio(from, to) {
  return `https://www.rome2rio.com/map/${encodeURIComponent(placeTitle(from))}/${encodeURIComponent(placeTitle(to))}`;
}

function money(amount, currency) {
  const value = Math.round(Number(amount) || 0);
  if (!value) return "";
  const symbols = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED " };
  const symbol = symbols[currency] || (currency ? `${currency} ` : "");
  const formatted = currency === "INR" ? value.toLocaleString("en-IN") : value.toLocaleString("en-US");
  return `${symbol}${formatted}`;
}

function normalizeRides(rides) {
  if (!Array.isArray(rides)) return [];
  return rides
    .map((ride) => ({
      mode: String(ride?.mode || "").toLowerCase(),
      service: String(ride?.service || "").trim(),
      duration: String(ride?.duration || "").trim(),
      typicalFare: String(ride?.typicalFare || "").replace(/\s+/g, " ").trim(),
      fareLow: Number(ride?.fareLow) || 0,
      why: String(ride?.why || "").trim(),
    }))
    .filter((ride) => MODE_IDS.includes(ride.mode));
}

function flightPartners({ from, to, date, adults, india }) {
  const fromEnds = flightEnds(from);
  const toEnds = flightEnds(to);
  const origin = fromEnds[0];
  const dest = toEnds[0];
  if (!origin || !dest) {
    return [
      {
        id: "google-flights",
        name: "Google Flights",
        detail: "Compares airlines on this date",
        action: "Compare on Google Flights",
        href: googleFlights({
          fromLabel: placeTitle(from),
          toLabel: placeTitle(to),
          date,
          adults,
        }),
        primary: true,
      },
    ];
  }

  const fromLabel = origin.city;
  const toLabel = dest.city;
  const via = [
    origin.nearby ? `${placeTitle(from)} has no airport. This search is ${origin.city} (${origin.iata})` : "",
    dest.nearby ? `${placeTitle(to)} has no airport. This search is ${dest.city} (${dest.iata})` : "",
  ]
    .filter(Boolean)
    .join(". ");
  const when = date ? formatDay(date) : "";
  const searchLine = `${fromLabel} (${origin.iata}) → ${toLabel} (${dest.iata})${when ? ` · ${when}` : ""} · ${adults} adult${adults > 1 ? "s" : ""}`;
  const showIndia = india || origin.country === "India" || dest.country === "India";
  const partners = [
    {
      id: "google-flights",
      name: "Google Flights",
      detail: searchLine,
      action: "See fare",
      href: googleFlights({ fromLabel, toLabel, fromCode: origin.iata, toCode: dest.iata, date, adults }),
      primary: true,
      routeNote: via,
    },
    {
      id: "skyscanner",
      name: "Skyscanner",
      detail: searchLine,
      action: "See fare",
      href: `https://${showIndia ? "www.skyscanner.co.in" : "www.skyscanner.net"}/transport/flights/${origin.sky}/${dest.sky}/${yymmdd(date)}/?adultsv2=${adults}&cabinclass=economy&rtn=0&preferdirects=false`,
    },
    {
      id: "kayak",
      name: "Kayak",
      detail: searchLine,
      action: "See fare",
      href: kayakFlights({ fromCode: origin.iata, toCode: dest.iata, date, adults, india: showIndia }),
    },
  ];
  if (showIndia) {
    const day = slashDate(date);
    partners.push(
      {
        id: "ixigo",
        name: "Ixigo",
        detail: searchLine,
        action: "See fare",
        href: `https://www.ixigo.com/search/result/flight?from=${origin.iata}&to=${dest.iata}&date=${ddmmyyyy(date)}&adults=${adults}&children=0&infants=0&class=e&source=Search%20Form`,
      },
      {
        id: "goibibo",
        name: "Goibibo",
        detail: searchLine,
        action: "See fare",
        href: `https://www.goibibo.com/flights/${slug(fromLabel)}-${slug(toLabel)}-${origin.iata}-${dest.iata}-${yyyymmdd(date)}--${adults}-0-0-E-D/`,
      },
      {
        id: "makemytrip",
        name: "MakeMyTrip",
        detail: searchLine,
        action: "See fare",
        href: `https://www.makemytrip.com/flight/search?itinerary=${origin.iata}-${dest.iata}-${day}&tripType=O&paxType=A-${adults}_C-0_I-0&intl=false&cabinClass=E&lang=eng`,
      },
      {
        id: "cleartrip",
        name: "Cleartrip",
        detail: searchLine,
        action: "See fare",
        href: `https://www.cleartrip.com/flights/results?from=${origin.iata}&to=${dest.iata}&depart_date=${day}&adults=${adults}&childs=0&infants=0&class=Economy&intl=n`,
      },
      {
        id: "yatra",
        name: "Yatra",
        detail: searchLine,
        action: "See fare",
        href: `https://www.yatra.com/air-search-ui/dom2/trigger?type=O&viewName=normal&flexi=0&noOfSegments=1&origin=${origin.iata}&originCountry=IN&destination=${dest.iata}&destinationCountry=IN&flight_depart_date=${day}&ADT=${adults}&CHD=0&INF=0&class=Economy`,
      },
    );
  }
  for (const alt of fromEnds.slice(1)) {
    partners.push({
      id: `google-${alt.iata}`,
      name: `Google · ${alt.city}`,
      detail: `${alt.city} (${alt.iata}) → ${toLabel} (${dest.iata})${when ? ` · ${when}` : ""} · ${adults} adult${adults > 1 ? "s" : ""}`,
      action: "See fare",
      href: googleFlights({
        fromLabel: alt.city,
        toLabel,
        fromCode: alt.iata,
        toCode: dest.iata,
        date,
        adults,
      }),
    });
  }
  return partners;
}

function railPlace(city) {
  const key = slug(city);
  if (key === "delhi") return "new-delhi";
  return key;
}

function indiaTrainPartners(from, to) {
  const path = `${railPlace(from)}-to-${railPlace(to)}`;
  return [
    {
      id: "confirmtkt",
      name: "ConfirmTkt",
      detail: "Train list and fares for this route",
      action: "See train fares",
      href: `https://www.confirmtkt.com/trains/${path}-train-tickets`,
      primary: true,
    },
    {
      id: "railyatri",
      name: "RailYatri",
      detail: "Same Indian Railways trains and fares",
      action: "Check RailYatri",
      href: `https://www.railyatri.in/${path}-trains`,
    },
    {
      id: "ixigo-trains",
      name: "Ixigo Trains",
      detail: "Same trains, another checkout",
      action: "Check Ixigo Trains",
      href: `https://www.ixigo.com/by-train-rail/${path}-by-train`,
    },
    {
      id: "irctc",
      name: "IRCTC",
      detail: "Official Indian Railways booking",
      action: "Book on IRCTC",
      href: "https://www.irctc.co.in/nget/train-search",
    },
  ];
}

const ABHIBUS_ROUTES = {
  "azamgarh|delhi": "https://www.abhibus.com/buses/17909/Azamgarh-Delhi",
};

function indiaBusPartners(from, to, date) {
  const fromName = placeTitle(from);
  const toName = placeTitle(to);
  const path = `${slug(from)}-to-${slug(to)}`;
  const known = ABHIBUS_ROUTES[`${slug(from)}|${slug(to)}`];
  const onward = redbusDate(date);
  const redbus = new URLSearchParams({
    fromCityName: fromName,
    toCityName: toName,
    ...(onward ? { onward } : {}),
    srcCountry: "IND",
    destCountry: "IND",
  });
  return [
    {
      id: "redbus",
      name: "redBus",
      detail: onward ? `Coach list for this route. Travel date ${onward} is in the link.` : "Coach list for this route",
      action: "See buses on redBus",
      href: `https://www.redbus.in/bus-tickets/${path}?${redbus}`,
      primary: true,
    },
    {
      id: "abhibus",
      name: "AbhiBus",
      detail: "Often a different operator mix",
      action: "Check AbhiBus",
      href: known || `https://www.abhibus.com/bus-tickets/${path}`,
    },
  ];
}

function railPartners(from, to, date, fromCountry, toCountry) {
  if (fromCountry === "India" && toCountry === "India") return indiaTrainPartners(from, to);
  const bothEurope = EUROPE.has(fromCountry) && EUROPE.has(toCountry);
  const same = fromCountry && fromCountry === toCountry;
  const partners = [];
  if (bothEurope || (same && EUROPE.has(fromCountry))) {
    partners.push({
      id: "omio",
      name: "Omio",
      detail: "Compares rail on this route",
      action: "See fares on Omio",
      href: `https://www.omio.com/trains/${slug(from)}/${slug(to)}?date=${date}`,
      primary: true,
    });
  }
  if (same && fromCountry === "United Kingdom") {
    partners.push({
      id: "national-rail",
      name: "National Rail",
      detail: "Official UK rail planner",
      action: "See fares on National Rail",
      href: `https://www.nationalrail.co.uk/journey-planner/?type=single&origin=${encodeURIComponent(placeTitle(from))}&destination=${encodeURIComponent(placeTitle(to))}&leavingDate=${date}&adults=1`,
      primary: !partners.length,
    });
  }
  if (same && fromCountry === "France") {
    partners.push({
      id: "sncf",
      name: "SNCF Connect",
      detail: "Official French rail",
      action: "Book on SNCF",
      href: "https://www.sncf-connect.com/en-en",
    });
  }
  if (same && fromCountry === "Germany") {
    partners.push({
      id: "db",
      name: "Deutsche Bahn",
      detail: "Official German rail",
      action: "Book on Deutsche Bahn",
      href: `https://www.bahn.de/buchung/start?so=${encodeURIComponent(placeTitle(from))}&zo=${encodeURIComponent(placeTitle(to))}`,
    });
  }
  if (same && fromCountry === "Japan") {
    partners.unshift({
      id: "navitime",
      name: "Navitime",
      detail: "Japan rail fares and routes",
      action: "See fares on Navitime",
      href: `https://japantravel.navitime.com/en/area/jp/route/search?start=${encodeURIComponent(placeTitle(from))}&goal=${encodeURIComponent(placeTitle(to))}`,
      primary: true,
    });
  }
  if (same && fromCountry === "United States") {
    partners.push({
      id: "amtrak",
      name: "Amtrak",
      detail: "Official US rail booking",
      action: "Book on Amtrak",
      href: "https://www.amtrak.com/tickets/departure.html",
    });
  }
  if (same && fromCountry === "China") {
    partners.push({
      id: "trip-trains",
      name: "Trip.com Trains",
      detail: "China rail for foreign passports",
      action: "See fares on Trip.com",
      href: "https://www.trip.com/trains/china/",
      primary: !partners.some((item) => item.primary),
    });
    partners.push({
      id: "12306",
      name: "12306",
      detail: "Official China Railway",
      action: "Open 12306",
      href: "https://www.12306.cn/en/index.html",
    });
  }
  partners.push({
    id: "rome2rio-train",
    name: "Rome2Rio",
    detail: bothEurope || same ? "Route map and typical prices" : "Any rail connection on this route",
    action: "See route prices",
    href: rome2rio(from, to),
    primary: !partners.some((item) => item.primary),
  });
  return partners;
}

function busPartners(from, to, date, fromCountry, toCountry) {
  if (fromCountry === "India" && toCountry === "India") return indiaBusPartners(from, to, date);
  const bothEurope = EUROPE.has(fromCountry) && EUROPE.has(toCountry);
  const same = fromCountry && fromCountry === toCountry;
  const sea = SOUTHEAST_ASIA.has(fromCountry) && SOUTHEAST_ASIA.has(toCountry);
  const partners = [];
  if (bothEurope || (same && EUROPE.has(fromCountry))) {
    partners.push({
      id: "omio-bus",
      name: "Omio",
      detail: "Compares coach fares",
      action: "See buses on Omio",
      href: `https://www.omio.com/buses/${slug(from)}/${slug(to)}?date=${date}`,
      primary: true,
    });
    partners.push({
      id: "flixbus",
      name: "FlixBus",
      detail: "European coach network",
      action: "Check FlixBus",
      href: `https://global.flixbus.com/bus/${slug(from)}-${slug(to)}`,
    });
  }
  if (sea) {
    partners.push({
      id: "12go",
      name: "12Go",
      detail: "Buses and trains across this region",
      action: "See fares on 12Go",
      href: `https://12go.asia/en/travel/${slug(from)}/${slug(to)}?date=${date}`,
      primary: true,
    });
  }
  if (same && (fromCountry === "United States" || fromCountry === "Canada")) {
    partners.push({
      id: "greyhound",
      name: "Greyhound",
      detail: "Intercity coaches",
      action: "Check Greyhound",
      href: "https://www.greyhound.com/",
    });
  }
  if (same && fromCountry === "United Kingdom") {
    partners.push({
      id: "national-express",
      name: "National Express",
      detail: "UK coach booking",
      action: "Check National Express",
      href: "https://www.nationalexpress.com/en",
      primary: !partners.some((item) => item.primary),
    });
  }
  partners.push({
    id: "rome2rio-bus",
    name: "Rome2Rio",
    detail: "Coach options and typical prices",
    action: "See route prices",
    href: rome2rio(from, to),
    primary: !partners.some((item) => item.primary),
  });
  return partners;
}

function flightSuggestions({ from, to, date, adults, picks }) {
  const origin = flightEnds(from)[0];
  const dest = flightEnds(to)[0];
  const fromLabel = origin?.city || placeTitle(from);
  const toLabel = dest?.city || placeTitle(to);
  const list = (Array.isArray(picks) ? picks : [])
    .map((pick) => {
      const stops = Math.min(2, Math.max(0, Number(pick?.stops) || 0));
      const via = stops === 0 ? "" : String(pick?.via || "").trim();
      const airline = String(pick?.airline || "").trim();
      const fareLow = Number(pick?.fareLow) || 0;
      if (!airline || !fareLow) return null;
      return {
        airline,
        via,
        stops,
        stopsLabel: stopLabel(stops),
        duration: String(pick?.duration || "").trim(),
        typicalFare: String(pick?.typicalFare || "").replace(/\s+/g, " ").trim(),
        fareLow,
        why: String(pick?.why || "").replace(/\s+/g, " ").trim(),
        href: googleFlights({ fromLabel, toLabel, date, adults, airline, via }),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.fareLow - b.fareLow)
    .slice(0, 3);
  return list.map((pick, index) => ({ ...pick, best: index === 0 }));
}

function modeHint(id, _partners, { indiaDomestic, picks }) {
  if (id === "flight") {
    if (picks > 0) {
      return "The first flight is the lower fare. Amounts are typical totals, and each link opens that search.";
    }
    return "";
  }
  if (id === "train" && indiaDomestic) {
    return "Indian Railways sets the fare for a train and class. IRCTC is the official site. ConfirmTkt, Ixigo, and RailYatri list the same trains.";
  }
  if (id === "bus" && indiaDomestic) {
    return "Coach prices are not fixed. Open redBus and AbhiBus and book the lower total.";
  }
  return "Open each site. Today’s fare is on the booking page — book the lower total.";
}

function partnersFor(id, ctx) {
  if (id === "flight") return flightPartners(ctx);
  if (id === "train") return railPartners(ctx.from, ctx.to, ctx.date, ctx.fromCountry, ctx.toCountry);
  return busPartners(ctx.from, ctx.to, ctx.date, ctx.fromCountry, ctx.toCountry);
}

export function buildJourney(input) {
  const from = placeTitle(input?.from);
  const to = placeTitle(input?.to);
  const selected = (Array.isArray(input?.modes) ? input.modes : parseModes(input?.modes)).filter((id) =>
    MODE_IDS.includes(id),
  );
  if (!from || !to || !selected.length) return null;

  const fromCountry = normalizeCountry(input?.originCountry) || countryFromLabel(input?.from) || countryFromProfile(input?.profile);
  const toCountry = normalizeCountry(input?.destCountry) || countryFromLabel(input?.to);
  const date = input?.date || "";
  const adults = Math.min(9, Math.max(1, Number(input?.adults) || 1));
  const kids = Math.max(0, Number(input?.kids) || 0);
  const currency = input?.currency || input?.profile?.currency || "INR";
  const india = fromCountry === "India";
  const indiaDomestic = india && toCountry === "India";
  const rides = normalizeRides(input?.rides);
  const suggestions = flightSuggestions({ from, to, date, adults, picks: input?.flightPicks });
  const ctx = { from, to, date, adults, india, fromCountry, toCountry };

  const options = selected.map((id) => {
    const meta = TRANSPORT_MODES.find((mode) => mode.id === id);
    const ride = rides.find((item) => item.mode === id);
    const partners = partnersFor(id, ctx);
    const primary = partners.find((item) => item.primary) || partners[0];
    const picks = id === "flight" ? suggestions : [];
    const bestPick = picks[0];
    const price = (bestPick?.typicalFare
      || (ride?.fareLow ? ride.typicalFare || `from ${money(ride.fareLow, currency)}` : "")
      || (ride ? "Not a practical way" : "Today’s fare on the site")
    ).replace(/\s+/g, " ");
    return {
      id,
      label: meta?.label || id,
      service: ride?.service || "",
      duration: ride?.duration || "",
      price,
      fareLow: bestPick?.fareLow || ride?.fareLow || 0,
      why: id === "flight" ? "" : ride?.why || "",
      hint: modeHint(id, partners, { indiaDomestic, picks: picks.length }),
      routeNote: partners.find((item) => item.routeNote)?.routeNote || "",
      picks,
      picking: id === "flight" && !Array.isArray(input?.flightPicks),
      impractical: id !== "flight" && Boolean(ride) && !ride.fareLow,
      partners: id === "flight" ? [] : partners.map((item) => ({ ...item, primary: item === primary })),
    };
  });

  const priced = options.filter((option) => option.fareLow > 0).sort((a, b) => a.fareLow - b.fareLow);
  const best = priced[0] || null;
  const runner = priced[1] || null;
  if (best) best.recommended = true;

  let headline = "Open the booking sites. Each search is filled with your cities and date.";
  if (best) {
    const gap = runner ? money(runner.fareLow - best.fareLow, currency) : "";
    const comparison = runner && gap ? ` ${runner.label} is typically ${gap} more per adult.` : "";
    headline = `${best.label} is usually the lower fare.${best.why ? ` ${best.why}` : ""}${comparison}`;
  }

  const order = { flight: 0, train: 1, bus: 2 };
  options.sort((a, b) => {
    if (a.recommended) return -1;
    if (b.recommended) return 1;
    const aFare = a.fareLow > 0 ? a.fareLow : Number.MAX_SAFE_INTEGER;
    const bFare = b.fareLow > 0 ? b.fareLow : Number.MAX_SAFE_INTEGER;
    if (aFare !== bFare) return aFare - bFare;
    return order[a.id] - order[b.id];
  });

  const party = [`${adults} adult${adults === 1 ? "" : "s"}`, kids ? `${kids} child${kids === 1 ? "" : "ren"}` : ""]
    .filter(Boolean)
    .join(" · ");

  let footnote =
    "Fares shown here are typical for the season, per adult, one way. Each link opens a live search. Flight and bus totals change by the hour — book the lower one you see.";
  if (indiaDomestic && selected.includes("train")) {
    footnote += " Train fares for the same class are set by Indian Railways.";
  }

  return {
    from,
    to,
    when: date ? formatDay(date) : "",
    party,
    headline,
    footnote,
    options,
  };
}
