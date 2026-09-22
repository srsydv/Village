import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import { countActivity, listActivity, listActivityForEmail } from "../lib/activity.js";
import { countSearches, listSearchesForEmail, topDestinations } from "../lib/searches.js";
import { getUser, listUsersForAdmin, userStats } from "../lib/users.js";

const router = Router();

router.use(requireAdmin);

function lastAsk(chat) {
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user" && messages[i].content) {
      return String(messages[i].content).slice(0, 180);
    }
  }
  return "";
}

function cleanRow(row) {
  if (!row) return row;
  const { _id, googleId, ...rest } = row;
  return { id: _id ? String(_id) : undefined, ...rest };
}

function slimUser(row) {
  return {
    id: String(row._id),
    email: row.email || "",
    name: row.name || "",
    picture: row.picture || "",
    homeCity: row.homeCity || "",
    currency: row.currency || "INR",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    chatCount: row.chatCount || 0,
    tripCount: row.tripCount || 0,
    lastAsk: lastAsk(row.lastChat),
    lastChatAt: row.lastChat?.updatedAt || null,
  };
}

router.get("/overview", async (_req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [stats, asks, plans, places, searches, asksWeek, destinations, recent] = await Promise.all([
    userStats(),
    countActivity({ action: "ask" }),
    countActivity({ action: "plan" }),
    countActivity({ action: "places" }),
    countSearches(),
    countActivity({ action: "ask", at: { $gte: weekAgo } }),
    topDestinations(8),
    listActivity(40),
  ]);
  return res.json({
    cards: [
      {
        key: "users",
        label: "Users",
        value: stats.users,
        note: "People who signed in with Google.",
      },
      {
        key: "asks",
        label: "Questions",
        value: asks,
        note: "Chat questions sent to Safar. Includes what they typed.",
      },
      {
        key: "asksWeek",
        label: "Questions this week",
        value: asksWeek,
        note: "Asks in the last 7 days.",
      },
      {
        key: "plans",
        label: "Plans generated",
        value: plans,
        note: "Itineraries Safar built. Includes plans they did not save.",
      },
      {
        key: "savedTrips",
        label: "Saved trips",
        value: stats.savedTrips,
        note: "Trips they tapped Save on.",
      },
      {
        key: "searches",
        label: "Searches",
        value: searches,
        note: "Every plan or place lookup, even if they left without saving.",
      },
      {
        key: "chats",
        label: "Chat threads",
        value: stats.chats,
        note: "Ask conversations stored on user accounts.",
      },
      {
        key: "places",
        label: "Place lookups",
        value: places,
        note: "Destination catalog searches (hotels, food, sights).",
      },
    ],
    destinations: (destinations || []).map((row) => ({ name: row._id, count: row.count })),
    recent: (recent || []).map(cleanRow),
  });
});

router.get("/users", async (_req, res) => {
  const users = await listUsersForAdmin(200);
  return res.json({ users: users.map(slimUser) });
});

router.get("/users/:id", async (req, res) => {
  const user = await getUser(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const [activity, searches] = await Promise.all([
    listActivityForEmail(user.email, 200),
    listSearchesForEmail(user.email, 200),
  ]);
  return res.json({
    user: {
      id: String(user._id),
      email: user.email || "",
      name: user.name || "",
      picture: user.picture || "",
      homeCity: user.homeCity || "",
      currency: user.currency || "INR",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      chats: Array.isArray(user.chats) ? user.chats : [],
      trips: Array.isArray(user.trips) ? user.trips : [],
    },
    activity: activity.map(cleanRow),
    searches: searches.map(cleanRow),
  });
});

export default router;
