function slug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const STATE_SITES = {
  uttarpradesh: "https://up.gov.in/",
  bihar: "https://state.bihar.gov.in/",
  madhyapradesh: "https://mp.gov.in/",
  rajasthan: "https://rajasthan.gov.in/",
  maharashtra: "https://www.maharashtra.gov.in/",
};

export function officialSources({ pincode, district, state }) {
  const dslug = slug(district);
  const sources = [];
  if (dslug) {
    sources.push({
      id: "district",
      title: `${district} जिला कार्यालय`,
      url: `https://${dslug}.nic.in/`,
      kind: "government",
    });
  }
  const sslug = slug(state);
  if (STATE_SITES[sslug]) {
    sources.push({
      id: "state",
      title: `${state} सरकार`,
      url: STATE_SITES[sslug],
      kind: "government",
    });
  }
  sources.push(
    {
      id: "india",
      title: "भारत सरकार",
      url: "https://www.india.gov.in/",
      kind: "government",
    },
    {
      id: "pib",
      title: "प्रेस सूचना ब्यूरो",
      url: "https://www.pib.gov.in/indexd.aspx",
      kind: "government",
    },
    {
      id: "mygov",
      title: "MyGov",
      url: "https://www.mygov.in/",
      kind: "government",
    },
  );
  if (pincode) {
    sources.unshift({
      id: "pin",
      title: `पिन ${pincode} डाकघर`,
      url: `https://www.indiapost.gov.in/`,
      kind: "government",
    });
  }
  return sources;
}

const ALLOWED_HOSTS = [
  "nic.in",
  "gov.in",
  "india.gov.in",
  "pib.gov.in",
  "mygov.in",
  "up.gov.in",
  "indiapost.gov.in",
];

export function isOfficialUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return ALLOWED_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

export function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

export async function fetchOfficialPage(url) {
  if (!isOfficialUrl(url)) throw new Error("केवल सरकारी साइट");
  const res = await fetch(url, {
    headers: {
      "User-Agent": "VillageNews/1.0",
      Accept: "text/html",
    },
    redirect: "follow",
  });
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return {
    url,
    ok: res.ok,
    status: res.status,
    title: titleMatch ? stripHtml(titleMatch[1]).slice(0, 180) : url,
    excerpt: stripHtml(html).slice(0, 1200),
  };
}
