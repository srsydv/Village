import { formatTripSpan } from "./dates.js";
import { pickCount } from "./links.js";

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
    for (const [key, value] of budget) lines.push(`• ${key}: ${value}`);
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
  return lines.join("\n");
}

export async function shareTrip(trip) {
  const text = tripToText(trip);
  const title = trip?.plan?.title || trip?.plan?.destination || "Trip";
  if (typeof navigator !== "undefined" && navigator.share) {
    await navigator.share({ title, text });
    return "shared";
  }
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
  throw new Error("Sharing is not available on this device.");
}
