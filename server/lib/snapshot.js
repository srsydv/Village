function clip(value, max) {
  return String(value || "").slice(0, max);
}

function compactList(list, map, limit) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, limit).map(map).filter(Boolean);
}

export function planSnapshot(plan) {
  if (!plan || typeof plan !== "object") return null;
  return {
    title: clip(plan.title, 180),
    destination: clip(plan.destination, 160),
    country: clip(plan.country, 80),
    summary: clip(plan.summary, 900),
    duration: clip(plan.duration, 80),
    daysCount: plan.daysCount,
    startDate: clip(plan.startDate, 20),
    endDate: clip(plan.endDate, 20),
    bestTime: clip(plan.bestTime, 120),
    budget: plan.budget && typeof plan.budget === "object" ? plan.budget : plan.expenses || undefined,
    visa: plan.visa
      ? {
          needed: plan.visa.needed,
          summary: clip(plan.visa.summary || plan.visa.notes || plan.visa.detail, 400),
        }
      : undefined,
    hotels: compactList(
      plan.hotels,
      (hotel) => ({
        name: clip(hotel.name, 80),
        area: clip(hotel.area, 80),
        tier: clip(hotel.tier, 40),
        pricePerNight: clip(hotel.pricePerNight, 40),
        why: clip(hotel.why, 180),
      }),
      4,
    ),
    days: compactList(
      plan.days,
      (day) => ({
        day: day.day,
        title: clip(day.title, 90),
        morning: clip(day.morning, 280),
        afternoon: clip(day.afternoon, 280),
        evening: clip(day.evening, 280),
        food: clip(day.food, 180),
        cost: clip(day.cost, 80),
      }),
      12,
    ),
  };
}

export function placesSnapshot(data) {
  if (!data || typeof data !== "object") return null;
  const names = (list) =>
    compactList(
      list,
      (place) => ({
        name: clip(place.name || place.title, 90),
        area: clip(place.area || place.address, 80),
      }),
      6,
    );
  return {
    stays: names(data.stays || data.hotels),
    food: names(data.food),
    sights: names(data.sights),
  };
}
