import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAdminUser } from "../lib/api.js";
import {
  actionMeta,
  findChatForActivity,
  findSearchForActivity,
  findTripForActivity,
  groupByDay,
  lastUserAsk,
  relTime,
  when,
} from "../lib/adminFormat.js";
import { AdminAvatar, AdminChatMessages, AdminTabs, EmptyNote, NameList, ToneDot } from "./AdminUi.jsx";
import { ItineraryView } from "./ItineraryView.jsx";

function activityKey(row, index) {
  return row.id || `${row.action}-${row.at}-${index}`;
}

function ActivityReply({ row, chats, trips, searches }) {
  const storedPlan = row.plan;
  const trip = storedPlan ? null : findTripForActivity(row, trips);
  const search = findSearchForActivity(row, searches);
  const plan = storedPlan || trip?.plan || search?.resultPlan;
  const chatHit = row.action === "ask" ? findChatForActivity(row, chats) : null;
  const chatTurn = chatHit
    ? (chatHit.chat.messages || []).slice(chatHit.index, chatHit.index + 2)
    : [];
  const places = row.places || search?.places;
  const picks = trip?.picks;

  if (row.action === "ask") {
    if (chatTurn.length) return <AdminChatMessages messages={chatTurn} />;
    if (row.reply) {
      return (
        <AdminChatMessages
          messages={[
            { role: "user", content: row.query },
            { role: "assistant", content: row.reply },
          ]}
        />
      );
    }
  }

  if (row.action === "plan" && plan) {
    return (
      <div>
        <p className="mb-2 text-xs text-[var(--muted)]">
          {trip ? "Opened from their saved trip." : "What Aurea generated for this plan."}
        </p>
        <ItineraryView plan={plan} weather={trip?.weather} />
      </div>
    );
  }

  if (row.action === "places") {
    const stay = picks?.stay ? [picks.stay] : places?.stays;
    const food = picks?.food?.length ? picks.food : places?.food;
    const sights = picks?.sights?.length ? picks.sights : places?.sights;
    if (stay?.length || food?.length || sights?.length) {
      return (
        <div className="space-y-4">
          <NameList title="Stays they saw" items={stay} />
          <NameList title="Food they saw" items={food} />
          <NameList title="Sights they saw" items={sights} />
        </div>
      );
    }
  }

  if (row.reply) {
    return (
      <AdminChatMessages
        messages={[
          { role: "user", content: row.query },
          { role: "assistant", content: row.reply },
        ]}
      />
    );
  }

  return (
    <p className="text-sm text-[var(--muted)]">
      This older log only stored the destination, not Aurea’s full reply. New asks and plans keep the answer here. If
      they saved the trip, open the Trips tab.
    </p>
  );
}

export function AdminUserScreen() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("chats");
  const [openChat, setOpenChat] = useState("");
  const [openActivity, setOpenActivity] = useState("");
  const [openTrip, setOpenTrip] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminUser(id)
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setOpenChat(next.user?.chats?.[0]?.id || "");
        const chats = next.user?.chats || [];
        const activity = next.activity || [];
        if (chats.length) setTab("chats");
        else if (activity.length) {
          setTab("activity");
          setOpenActivity(activityKey(activity[0], 0));
        } else if ((next.user?.trips || []).length) setTab("trips");
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load this user.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const user = data?.user;
  const chats = user?.chats || [];
  const activity = data?.activity || [];
  const searches = data?.searches || [];
  const trips = user?.trips || [];
  const days = groupByDay(activity);

  return (
    <div className="admin-page safe-top px-5 pb-[calc(1.6rem+env(safe-area-inset-bottom))]">
      <Link to="/admin?tab=people" className="text-sm text-[var(--gold)]">
        ← People
      </Link>

      {loading && <p className="mt-8 text-sm text-[var(--muted)]">Loading…</p>}
      {error && <p className="mt-8 text-sm text-[var(--rose)]">{error}</p>}

      {user && (
        <>
          <div className="card mt-5 flex items-start gap-4 rounded-[1.45rem] p-4">
            <AdminAvatar name={user.name} email={user.email} picture={user.picture} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="kicker">User</p>
              <h1 className="serif mt-1 text-[1.7rem] leading-tight font-semibold">{user.name || "No name yet"}</h1>
              <p className="mt-1 truncate text-sm text-[var(--muted)]">{user.email}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {user.homeCity || "No hometown"}
                {user.currency ? ` · ${user.currency}` : ""}
                {user.updatedAt ? ` · ${relTime(user.updatedAt)}` : ""}
              </p>
            </div>
          </div>

          <AdminTabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "chats", label: "Chats", count: chats.length },
              { id: "activity", label: "Activity", count: activity.length },
              { id: "searches", label: "Searches", count: searches.length },
              { id: "trips", label: "Trips", count: trips.length },
            ]}
          />

          {tab === "chats" && (
            <section className="mt-5">
              <p className="text-sm text-[var(--muted)]">What they typed, and what Aurea replied.</p>
              {chats.length === 0 ? (
                <EmptyNote>No Ask chats stored for this person yet.</EmptyNote>
              ) : (
                <ul className="mt-4 space-y-3">
                  {chats.map((chat, index) => {
                    const open = openChat === chat.id;
                    const preview = lastUserAsk(chat.messages);
                    return (
                      <li key={chat.id || index} className="card overflow-hidden rounded-[1.35rem]">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
                          onClick={() => setOpenChat(open ? "" : chat.id)}
                        >
                          <div className="min-w-0">
                            <p className="text-[0.68rem] tracking-wide text-[var(--gold)] uppercase">
                              Chat {index + 1}
                              {chat.updatedAt ? ` · ${relTime(chat.updatedAt)}` : ""}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm leading-snug">{preview || "Empty thread"}</p>
                          </div>
                          <span className="mt-1 shrink-0 text-xs text-[var(--muted)]">{open ? "Hide" : "Read"}</span>
                        </button>
                        {open && (
                          <div className="border-t border-[var(--line)] px-3 py-4">
                            <AdminChatMessages messages={chat.messages} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {tab === "activity" && (
            <section className="mt-5">
              <p className="text-sm text-[var(--muted)]">Tap a row to read what they asked and what Aurea sent back.</p>
              {days.length === 0 ? (
                <EmptyNote>No activity logged for this email yet.</EmptyNote>
              ) : (
                <div className="mt-4 space-y-5">
                  {days.map((group) => (
                    <section key={group.label}>
                      <p className="mb-2 text-[0.68rem] tracking-wide text-[var(--gold)] uppercase">{group.label}</p>
                      <ul className="space-y-2">
                        {group.rows.map((row, index) => {
                          const meta = actionMeta(row.action);
                          const key = activityKey(row, index);
                          const open = openActivity === key;
                          return (
                            <li key={key} className="card overflow-hidden rounded-[1.3rem]">
                              <button
                                type="button"
                                className="flex w-full gap-3 px-4 py-3.5 text-left"
                                onClick={() => setOpenActivity(open ? "" : key)}
                              >
                                <ToneDot tone={meta.tone} />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-[0.72rem] font-semibold text-[var(--gold-bright)]">
                                      {meta.label}
                                      {row.ok === false ? " · failed" : ""}
                                    </p>
                                    <p className="shrink-0 text-[0.68rem] text-[var(--muted)]">
                                      {open ? "Hide" : "Read"} · {relTime(row.at)}
                                    </p>
                                  </div>
                                  <p className="mt-1 text-sm leading-snug">{row.query || "—"}</p>
                                  {row.error ? <p className="mt-1 text-xs text-[var(--rose)]">{row.error}</p> : null}
                                </div>
                              </button>
                              {open && (
                                <div className="border-t border-[var(--line)] px-4 py-4">
                                  <ActivityReply row={row} chats={chats} trips={trips} searches={searches} />
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "searches" && (
            <section className="mt-5">
              <p className="text-sm text-[var(--muted)]">Plan and place lookups, even if they did not tap Save.</p>
              {searches.length === 0 ? (
                <EmptyNote>No stored searches for this person yet.</EmptyNote>
              ) : (
                <ul className="mt-4 space-y-2">
                  {searches.map((row) => {
                    const key = row.id || `${row.destination}-${row.at}`;
                    const open = openActivity === `search-${key}`;
                    return (
                      <li key={key} className="card overflow-hidden rounded-[1.3rem]">
                        <button
                          type="button"
                          className="w-full px-4 py-3.5 text-left"
                          onClick={() => setOpenActivity(open ? "" : `search-${key}`)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[0.72rem] font-semibold text-[var(--gold-bright)]">
                              {row.kind === "places" ? "Place lookup" : "Plan search"}
                            </p>
                            <p className="text-[0.68rem] text-[var(--muted)]">
                              {open ? "Hide" : "Read"} · {relTime(row.at)}
                            </p>
                          </div>
                          <p className="mt-1 text-sm">{row.destination || "—"}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {[row.startDate, row.endDate].filter(Boolean).join(" → ") || row.days || ""}
                            {row.budget ? ` · ${row.budget}` : ""}
                            {row.style ? ` · ${row.style}` : ""}
                            {row.resultTitle ? ` · ${row.resultTitle}` : ""}
                          </p>
                        </button>
                        {open && (
                          <div className="border-t border-[var(--line)] px-4 py-4">
                            <ActivityReply
                              row={{
                                ...row,
                                action: row.kind === "places" ? "places" : "plan",
                                query: row.destination,
                                plan: row.resultPlan,
                              }}
                              chats={chats}
                              trips={trips}
                              searches={searches}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {tab === "trips" && (
            <section className="mt-5">
              <p className="text-sm text-[var(--muted)]">Tap a trip to read the itinerary Aurea wrote.</p>
              {trips.length === 0 ? (
                <EmptyNote>No saved trips.</EmptyNote>
              ) : (
                <ul className="mt-4 space-y-3">
                  {trips.map((trip) => {
                    const open = openTrip === trip.id;
                    const plan = trip.plan || trip;
                    return (
                      <li key={trip.id} className="card overflow-hidden rounded-[1.3rem]">
                        <button
                          type="button"
                          className="w-full px-4 py-3.5 text-left"
                          onClick={() => setOpenTrip(open ? "" : trip.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="serif text-lg">{plan.title || plan.destination || "Trip"}</p>
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                {plan.destination || ""}
                                {plan.startDate ? ` · ${plan.startDate}` : ""}
                                {trip.createdAt ? ` · ${when(trip.createdAt)}` : ""}
                              </p>
                            </div>
                            <span className="mt-1 text-xs text-[var(--muted)]">{open ? "Hide" : "Read"}</span>
                          </div>
                        </button>
                        {open && (
                          <div className="border-t border-[var(--line)] px-4 py-4">
                            <ItineraryView plan={plan} weather={trip.weather} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
