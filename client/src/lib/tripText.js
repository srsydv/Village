import { formatTripSpan } from "./dates.js";
import { budgetLabel } from "./styleBudget.js";
import { pickCount, PLAY_STORE_URL } from "./links.js";

export function tripToText(trip) {
  const plan = trip?.plan || {};
  const picks = trip?.picks || {};
  const lines = [];
  const title = plan.title || plan.destination || "Trip";
  lines.push(title);
  const meta = [
    plan.destination,
    formatTripSpan(plan.startDate, plan.daysCount || plan.duration) || plan.duration,
    plan.budget?.total && `Budget ${plan.budget.total}`,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(" · "));
  if (plan.summary) {
    lines.push("");
    lines.push(plan.summary);
  }

  const budget = Object.entries(plan.budget || {}).filter(([, v]) => v);
  if (budget.length) {
    lines.push("");
    lines.push("Expenses (estimates — live prices on Booking / airline sites)");
    for (const [key, value] of budget) lines.push(`• ${budgetLabel(key)}: ${value}`);
  }

  if (plan.visa) {
    lines.push("");
    lines.push("Visa (you apply — Safar does not file)");
    lines.push(typeof plan.visa === "string" ? plan.visa : plan.visa.youApply || JSON.stringify(plan.visa));
  }

  if (plan.days?.length) {
    lines.push("");
    lines.push("Days");
    for (const day of plan.days) {
      lines.push(`Day ${day.day}: ${day.title || ""}`.trim());
      if (day.morning) lines.push(`  Morning: ${day.morning}`);
      if (day.afternoon) lines.push(`  Afternoon: ${day.afternoon}`);
      if (day.evening) lines.push(`  Evening: ${day.evening}`);
      if (day.food) lines.push(`  Food: ${day.food}`);
    }
  }

  const selected = [picks.stay, ...(picks.food || []), ...(picks.sights || [])].filter(Boolean);
  if (selected.length) {
    lines.push("");
    lines.push(`Picks (${pickCount(picks)})`);
    for (const place of selected) lines.push(`• ${place.name}${place.area ? ` — ${place.area}` : ""}`);
  }

  if (plan.packing?.length) {
    lines.push("");
    lines.push("Pack: " + plan.packing.join("; "));
  }

  lines.push("");
  lines.push("Drafted with Safar. Hotel and food prices are estimates.");
  lines.push(`Get Safar: ${PLAY_STORE_URL}`);
  return lines.join("\n");
}

export async function shareText({ title, text }) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
      throw err;
    }
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("Sharing is not available on this device.");
}

export async function shareTrip(trip) {
  const text = tripToText(trip);
  const title = trip?.plan?.title || trip?.plan?.destination || "Trip";
  return shareText({ title, text });
}

export async function shareApp({ username } = {}) {
  const handle = username ? ` Find me as @${username}.` : "";
  const text = `Plan trips with Safar — itineraries, stays, and a weekend idea from home.${handle}\n${PLAY_STORE_URL}`;
  return shareText({ title: "Safar", text });
}
