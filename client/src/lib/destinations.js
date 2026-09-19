export const DESTINATIONS = [
  {
    id: "kyoto",
    name: "Kyoto",
    country: "Japan",
    vibe: "Temples & tea",
    season: "Mar–May, Oct–Nov",
    from: "₹1.1L",
    tags: ["city", "heritage", "food"],
    image:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "santorini",
    name: "Santorini",
    country: "Greece",
    vibe: "Cliffside sunsets",
    season: "May–Oct",
    from: "₹1.4L",
    tags: ["beach", "luxury"],
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "bali",
    name: "Bali",
    country: "Indonesia",
    vibe: "Island calm",
    season: "Apr–Oct",
    from: "₹55k",
    tags: ["beach", "food", "luxury"],
    image:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "paris",
    name: "Paris",
    country: "France",
    vibe: "Art & cafés",
    season: "Apr–Jun, Sep–Oct",
    from: "₹1.2L",
    tags: ["city", "food", "luxury"],
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "zermatt",
    name: "Zermatt",
    country: "Switzerland",
    vibe: "Alpine air",
    season: "Dec–Mar, Jun–Sep",
    from: "₹1.8L",
    tags: ["mountain", "luxury", "adventure"],
    image:
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "maldives",
    name: "Maldives",
    country: "Indian Ocean",
    vibe: "Overwater villas",
    season: "Nov–Apr",
    from: "₹1.6L",
    tags: ["beach", "luxury"],
    image:
      "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "dubai",
    name: "Dubai",
    country: "UAE",
    vibe: "Modern luxury",
    season: "Nov–Mar",
    from: "₹45k",
    tags: ["city", "luxury"],
    image:
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "goa",
    name: "Goa",
    country: "India",
    vibe: "Beaches & spice",
    season: "Nov–Feb",
    from: "₹18k",
    tags: ["beach", "food", "budget"],
    image:
      "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "jaipur",
    name: "Jaipur",
    country: "India",
    vibe: "Pink city palaces",
    season: "Oct–Mar",
    from: "₹16k",
    tags: ["heritage", "city", "budget"],
    image:
      "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "rome",
    name: "Rome",
    country: "Italy",
    vibe: "Eternal city",
    season: "Apr–Jun, Sep–Oct",
    from: "₹1.15L",
    tags: ["city", "heritage", "food"],
    image:
      "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "iceland",
    name: "Reykjavík",
    country: "Iceland",
    vibe: "Fire & ice",
    season: "Jun–Aug, Sep–Mar",
    from: "₹1.9L",
    tags: ["adventure", "mountain"],
    image:
      "https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "nyc",
    name: "New York",
    country: "USA",
    vibe: "Never sleeps",
    season: "Apr–Jun, Sep–Nov",
    from: "₹1.5L",
    tags: ["city", "food"],
    image:
      "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1200&q=80",
  },
];

export const CATEGORIES = [
  { id: "beach", label: "Beaches", prompt: "Best beach destinations for a relaxing 6-day trip with hotel and daily budget ideas." },
  { id: "mountain", label: "Mountains", prompt: "Plan a scenic mountain getaway with stays, treks, and a realistic expense breakdown." },
  { id: "city", label: "Cities", prompt: "Suggest vibrant city breaks with neighborhoods, boutique hotels, and food walks." },
  { id: "heritage", label: "Heritage", prompt: "Recommend heritage and culture trips with palaces, museums, and local etiquette." },
  { id: "food", label: "Food", prompt: "Build a food-first travel plan with must-try dishes, markets, and restaurant tiers." },
  { id: "adventure", label: "Adventure", prompt: "Give adventure travel ideas with safety notes, gear, and activity costs." },
  { id: "luxury", label: "Luxury", prompt: "Design a luxury trip with 5-star hotels, private transfers, and refined dining." },
  { id: "budget", label: "Budget", prompt: "Create a smart budget trip with cheap flights, good hotels, and daily spend caps." },
];

export const QUICK_ASKS = [
  { id: "dest", label: "Where should I go?", prompt: "I have 5–7 days and want a destination recommendation with why, best season, budget, and hotel style." },
  { id: "money", label: "Trip budget", prompt: "Break down a realistic trip budget: flights, hotel, food, local travel, activities, and a buffer." },
  { id: "hotel", label: "Find hotels", prompt: "Suggest 3 hotels — value, balanced, and luxury — with area, nightly price, and who they suit." },
  { id: "plan", label: "Day-by-day plan", prompt: "Create a detailed day-by-day itinerary with morning, afternoon, evening, and estimated daily spend." },
  { id: "visa", label: "Visa & documents", prompt: "For my passport and this trip, what visa do I apply for myself, which official site, documents, timeline, and fee? Do not offer to file it." },
  { id: "pack", label: "What to pack", prompt: "Make a packing list for this trip by weather, dress code, and airline cabin rules." },
];
