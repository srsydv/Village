const TAG = "safartravel-21";
const cache = new Map();

function decode(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function money(value) {
  const amount = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

export function budgetRange(label) {
  const text = String(label || "");
  const nums = [...text.matchAll(/[\d,]+/g)].map((item) => Number(item[0].replace(/,/g, ""))).filter((n) => n > 0);
  if (/under/i.test(text) && nums[0]) return { min: 0, max: nums[0] };
  if (/above/i.test(text) && nums[0]) return { min: nums[0], max: Infinity };
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  return null;
}

export function parseAmazonSearch(html) {
  const blocks = String(html || "").split('data-component-type="s-search-result"').slice(1);
  const seen = new Set();
  const products = [];
  for (const block of blocks) {
    const labelled = block.match(/<h2[^>]*aria-label="([^"]+)"/);
    if (!labelled) continue;
    const before = block.slice(0, labelled.index);
    const links = [...before.matchAll(/\/dp\/([A-Z0-9]{10})/g)];
    const asin = links.at(-1)?.[1] || before.match(/amzn1\.asin\.(?:1\.)?([A-Z0-9]{10})/)?.[1];
    const rawName = decode(labelled[1]);
    const name = rawName.replace(/^Sponsored Ad\s*-\s*/i, "");
    const rating = Number(block.match(/([0-9.]+) out of 5 stars/)?.[1] || 0);
    const ratings = Number((block.match(/aria-label="([0-9,]+) ratings"/)?.[1] || "").replace(/,/g, "")) || 0;
    const price = money(block.match(/a-price-whole">([0-9,]+)/)?.[1]);
    if (!asin || !name || seen.has(asin) || rating <= 0) continue;
    seen.add(asin);
    products.push({
      asin,
      name,
      rating,
      ratings,
      price,
      sponsored: /^Sponsored Ad\s*-\s*/i.test(rawName),
      href: `https://www.amazon.in/dp/${asin}?tag=${TAG}`,
    });
  }
  return products;
}

const WORD_RULES = [
  {
    when: /\bfull\s+sleeves?\b|\blong\s+sleeves?\b/i,
    need: /\bfull\s+sleeves?\b|\blong\s+sleeves?\b|\bfullsleeve\b/i,
    block: /\bhalf\s+sleeves?\b|\bshort\s+sleeves?\b|\bsleeveless\b|\bhalfsleeve\b/i,
  },
  {
    when: /\bhalf\s+sleeves?\b|\bshort\s+sleeves?\b/i,
    need: /\bhalf\s+sleeves?\b|\bshort\s+sleeves?\b|\bhalfsleeve\b/i,
    block: /\bfull\s+sleeves?\b|\blong\s+sleeves?\b|\bfullsleeve\b/i,
  },
  {
    when: /\b100\s*%\s*cotton\b|\bpure\s+cotton\b|\b100\s+percent\s+cotton\b/i,
    need: /\bcotton\b/i,
    block: /\bpolyester\b|\bpolycotton\b|\bpoly\s*cotton\b|\bnylon\b|\bviscose\b|\bblend\b/i,
  },
  {
    when: /\bv-?neck\b/i,
    need: /\bv-?neck\b/i,
    block: /\bcrew\s+neck\b|\bround\s+neck\b|\bpolo\b/i,
  },
  {
    when: /\b(?:crew|round)\s+neck\b/i,
    need: /\b(?:crew|round)\s+neck\b/i,
    block: /\bv-?neck\b|\bpolo\b/i,
  },
  {
    when: /\bpolo\b/i,
    need: /\bpolo\b/i,
    block: /\bv-?neck\b/i,
  },
  {
    when: /\bplain\b/i,
    need: null,
    block: /\bprinted\b|\bgraphic\b|\btypography\b/i,
  },
];

function score(item) {
  const reviews = Math.max(item.ratings, 1);
  return (item.rating * reviews + 4 * 80) / (reviews + 80);
}

function wrongSize(name, query) {
  const asked = String(query || "").match(/\bsize\s+(XXS|XS|S|M|L|XL|XXL|3XL)\b/i);
  if (!asked) return false;
  const want = asked[1].toUpperCase();
  const named = [...String(name || "").matchAll(/\b(?:size|sizes)\s+(XXS|XS|S|M|L|XL|XXL|3XL)\b/gi)].map((item) => item[1].toUpperCase());
  if (!named.length || /[-–]|to\b/i.test(String(name || ""))) return false;
  return !named.includes(want);
}

export function matchesRequest(name, query) {
  const title = String(name || "");
  const asked = String(query || "");
  for (const rule of WORD_RULES) {
    if (!rule.when.test(asked)) continue;
    if (rule.block?.test(title)) return false;
    if (rule.need && !rule.need.test(title)) return false;
  }
  return !wrongSize(title, asked);
}

function rankProducts(products, budget, query) {
  const fitting = products.filter((item) => matchesRequest(item.name, query));
  const range = budgetRange(budget);
  const priced = fitting.filter((item) => item.price > 0);
  const inBudget = range
    ? priced.filter((item) => item.price >= range.min && item.price <= range.max)
    : [];
  const pool = inBudget.length ? inBudget : fitting;
  const organic = pool.filter((item) => !item.sponsored);
  const ranked = (organic.length >= 2 ? organic : pool).sort((a, b) => score(b) - score(a));
  const seen = new Set();
  const picked = [];
  for (const item of ranked) {
    const key = item.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 72);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item);
  }
  return picked;
}

const PAGE_HEADERS = {
  "Accept-Language": "en-IN,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

export async function amazonProducts(query, budget = "") {
  const q = String(query || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (q.length < 2) return [];
  const key = `${q}|${budget}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.products;
  const range = budgetRange(budget);
  let url = `https://www.amazon.in/s?k=${encodeURIComponent(q)}`;
  if (range?.max && range.max !== Infinity) {
    url += `&rh=${encodeURIComponent(`p_36:${Math.round(range.min * 100)}-${Math.round(range.max * 100)}`)}`;
  } else if (range?.min) {
    url += `&rh=${encodeURIComponent(`p_36:${Math.round(range.min * 100)}-`)}`;
  }
  const res = await fetch(url, {
    headers: PAGE_HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error("Amazon did not return products.");
  const html = await res.text();
  if (html.length < 20000) return [];
  const products = rankProducts(parseAmazonSearch(html), budget, q).slice(0, 3).map(({ sponsored, ...item }) => item);
  if (products.length) cache.set(key, { at: Date.now(), products });
  return products;
}
