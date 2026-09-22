import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchAdminOverview, fetchAdminUsers } from "../lib/api.js";
import { actionMeta, cardValue, groupByDay, relTime } from "../lib/adminFormat.js";
import { AdminAvatar, AdminTabs, EmptyNote, ToneDot } from "./AdminUi.jsx";

const PRIMARY = [
  { key: "users", label: "Users", hint: "Signed in with Google" },
  { key: "asks", label: "Questions", hint: "What people typed in Ask" },
  { key: "plans", label: "Plans", hint: "Itineraries generated" },
  { key: "savedTrips", label: "Saved trips", hint: "They tapped Save" },
];

const SECONDARY = [
  { key: "asksWeek", label: "This week" },
  { key: "chats", label: "Chat threads" },
  { key: "searches", label: "Searches" },
  { key: "places", label: "Place lookups" },
];

export function AdminScreen() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "people" ? "people" : "analysis";
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAdminOverview(), fetchAdminUsers()])
      .then(([nextOverview, nextUsers]) => {
        if (cancelled) return;
        setOverview(nextOverview);
        setUsers(nextUsers.users || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load admin.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTab = (next) => {
    setParams(next === "people" ? { tab: "people" } : {}, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.name, user.email, user.homeCity, user.lastAsk].join(" ").toLowerCase().includes(q),
    );
  }, [query, users]);

  const cards = overview?.cards || [];
  const destinations = overview?.destinations || [];
  const destMax = destinations[0]?.count || 1;
  const days = groupByDay(overview?.recent || []);

  return (
    <div className="admin-page safe-top px-5 pb-[calc(1.6rem+env(safe-area-inset-bottom))]">
      <Link to="/profile" className="text-sm text-[var(--gold)]">
        ← Profile
      </Link>
      <p className="kicker mt-5">Operator</p>
      <h1 className="serif gold-text mt-1 text-[2.15rem] leading-none font-semibold">Safar desk</h1>
      <p className="mt-2 max-w-[34rem] text-sm leading-relaxed text-[var(--muted)]">
        How the product is being used — then open anyone to read what they asked.
      </p>

      <AdminTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "analysis", label: "Analysis" },
          { id: "people", label: "People", count: users.length || undefined },
        ]}
      />

      {loading && <p className="mt-8 text-sm text-[var(--muted)]">Loading…</p>}
      {error && <p className="mt-8 text-sm text-[var(--rose)]">{error}</p>}

      {!loading && !error && tab === "analysis" && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {PRIMARY.map((item) => (
              <article key={item.key} className="card rounded-[1.25rem] p-4">
                <p className="text-[0.68rem] tracking-wide text-[var(--muted)] uppercase">{item.label}</p>
                <p className="serif mt-2 text-[2rem] leading-none text-[var(--gold-bright)]">{cardValue(cards, item.key)}</p>
                <p className="mt-2 text-[0.72rem] leading-snug text-[var(--muted)]">{item.hint}</p>
              </article>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {SECONDARY.map((item) => (
              <span
                key={item.key}
                className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[0.72rem] text-[#d8d2c6]"
              >
                {item.label} <span className="text-[var(--gold)]">{cardValue(cards, item.key)}</span>
              </span>
            ))}
          </div>

          <section className="mt-8">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="kicker">Places</p>
                <h2 className="serif mt-1 text-[1.45rem] font-semibold">Where they look</h2>
              </div>
            </div>
            {destinations.length === 0 ? (
              <EmptyNote>No plan or place searches yet. They show up here as soon as someone generates a plan.</EmptyNote>
            ) : (
              <ul className="card mt-4 space-y-3 rounded-[1.3rem] p-4">
                {destinations.map((row) => (
                  <li key={row.name}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{row.name}</span>
                      <span className="shrink-0 text-[var(--gold)]">{row.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[rgba(232,201,154,0.12)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#e8c99a,#c9a36a)]"
                        style={{ width: `${Math.max(8, (row.count / destMax) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <p className="kicker">Live</p>
            <h2 className="serif mt-1 text-[1.45rem] font-semibold">Recent activity</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Asks, plans, and lookups — newest first.</p>
            {days.length === 0 ? (
              <EmptyNote>Nothing logged yet.</EmptyNote>
            ) : (
              <div className="mt-4 space-y-5">
                {days.map((group) => (
                  <section key={group.label}>
                    <p className="mb-2 text-[0.68rem] tracking-wide text-[var(--gold)] uppercase">{group.label}</p>
                    <ul className="card divide-y divide-[var(--line)] overflow-hidden rounded-[1.3rem]">
                      {group.rows.map((row) => {
                        const meta = actionMeta(row.action);
                        return (
                          <li key={row.id || `${row.email}-${row.at}`} className="flex gap-3 px-4 py-3.5">
                            <ToneDot tone={meta.tone} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[0.72rem] font-semibold text-[var(--gold-bright)]">
                                  {meta.label}
                                  {row.ok === false ? " · failed" : ""}
                                </p>
                                <p className="shrink-0 text-[0.68rem] text-[var(--muted)]">{relTime(row.at)}</p>
                              </div>
                              <p className="mt-1 text-sm leading-snug">{row.query || "—"}</p>
                              <p className="mt-1 truncate text-xs text-[var(--muted)]">
                                {row.name || row.email || "Unknown"}
                                {row.homeCity ? ` · ${row.homeCity}` : ""}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {!loading && !error && tab === "people" && (
        <section className="mt-5">
          <input
            className="field"
            value={query}
            placeholder="Search name, email, city, or last question"
            onChange={(e) => setQuery(e.target.value)}
          />
          {filtered.length === 0 ? (
            <EmptyNote>{users.length ? "No one matches that search." : "No signed-in users yet."}</EmptyNote>
          ) : (
            <ul className="mt-4 space-y-3">
              {filtered.map((user) => (
                <li key={user.id}>
                  <Link to={`/admin/users/${user.id}`} className="card block rounded-[1.35rem] p-4">
                    <div className="flex items-center gap-3">
                      <AdminAvatar name={user.name} email={user.email} picture={user.picture} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.name || "No name yet"}</p>
                        <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
                      </div>
                      <span className="text-xs text-[var(--gold)]">{relTime(user.updatedAt) || "—"}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.68rem] text-[var(--muted)]">
                        {user.chatCount} chats
                      </span>
                      <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.68rem] text-[var(--muted)]">
                        {user.tripCount} trips
                      </span>
                      {user.homeCity ? (
                        <span className="max-w-[12rem] truncate rounded-full border border-[var(--line)] px-2.5 py-1 text-[0.68rem] text-[var(--muted)]">
                          {user.homeCity}
                        </span>
                      ) : null}
                    </div>
                    {user.lastAsk ? (
                      <p className="mt-3 line-clamp-2 border-t border-[var(--line)] pt-3 text-sm leading-relaxed text-[#d8d2c6]">
                        “{user.lastAsk}”
                      </p>
                    ) : (
                      <p className="mt-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">No Ask chat yet.</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
