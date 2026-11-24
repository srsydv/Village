import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { askSafar, suggestFlights } from "../lib/api.js";
import { ASK_IDEAS, readOffer, replySteps } from "../lib/askOffers.js";
import { chatPreview, planSeedFromChat } from "../lib/chatHints.js";
import { timeAgo, tomorrowIso } from "../lib/dates.js";
import { placeLinks, STAY_PARTNERS } from "../lib/links.js";
import { RichText } from "../lib/richtext.jsx";
import { STAY_STANDARDS, staySearchUrl } from "../lib/stays.js";
import { getChats, uid } from "../lib/storage.js";
import { buildJourney } from "../lib/transport.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { AskSteps } from "./AskSteps.jsx";
import { ProductFinder } from "./ProductFinder.jsx";
import { FlightBook, FlightIssue } from "./FlightBook.jsx";

export function ChatScreen() {
  const { profile, chats, addChat, removeChat } = useTravel();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const incoming = params.get("q") || "";
  const requestedId = params.get("chat") || "";
  const openHistory = params.get("history") === "1";
  const [chatId, setChatId] = useState(() => requestedId || chats[0]?.id || uid());
  const [messages, setMessages] = useState(() => {
    const found = requestedId ? chats.find((c) => c.id === requestedId) : chats[0];
    return found?.messages || [];
  });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(openHistory);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [ideaSet, setIdeaSet] = useState(0);
  const scroller = useRef(null);
  const asked = useRef(false);

  const persist = (next, id = chatId) => {
    setMessages(next);
    const existing = getChats().find((item) => item.id === id) || {};
    addChat({ ...existing, id, updatedAt: Date.now(), messages: next, shops: existing.shops });
  };

  const saveShop = (question, answers) => {
    const existing = getChats().find((item) => item.id === chatId);
    if (!existing || JSON.stringify(existing.shops?.[question]) === JSON.stringify(answers)) return;
    addChat({
      ...existing,
      updatedAt: Date.now(),
      shops: { ...(existing.shops || {}), [question]: answers },
    });
  };

  const loadChat = (chat) => {
    setChatId(chat.id);
    setMessages(chat.messages || []);
    setError("");
    setHistoryOpen(false);
  };

  const startNew = () => {
    const id = uid();
    setChatId(id);
    persist([], id);
    setError("");
    setHistoryOpen(false);
  };

  const send = async (text) => {
    const content = String(text || "").trim();
    if (!content || busy) return;
    setError("");
    setDraft("");
    const next = [...messages, { role: "user", content }];
    persist(next);
    setBusy(true);
    const assistant = { role: "assistant", content: "" };
    persist([...next, assistant]);
    try {
      const full = await askSafar({
        messages: next,
        profile,
        onDelta: (_delta, all) => {
          persist([...next, { role: "assistant", content: all }]);
        },
      });
      persist([...next, { role: "assistant", content: full }]);
    } catch (err) {
      setError(err.message || "Safar could not reply.");
      persist(next);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (requestedId) {
      const found = chats.find((c) => c.id === requestedId);
      if (found) loadChat(found);
    }
    if (openHistory) setHistoryOpen(true);
    if (requestedId || openHistory) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("chat");
          next.delete("history");
          return next;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!incoming || asked.current) return;
    asked.current = true;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        return next;
      },
      { replace: true },
    );
    send(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const lists = box.querySelectorAll("[data-flights]");
    const flights = lists[lists.length - 1];
    if (flights) {
      flights.scrollIntoView({ block: "nearest" });
      return;
    }
    box.scrollTo({ top: box.scrollHeight });
  }, [messages, busy]);

  const empty = messages.length === 0 && !busy;
  const past = chats.filter((c) => (c.messages || []).some((m) => m.content));
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
  const seed = lastAssistant && !busy ? planSeedFromChat(messages) : null;

  const goPlan = () => {
    if (!seed) return;
    const qs = new URLSearchParams();
    if (seed.q) qs.set("q", seed.q);
    if (seed.notes) qs.set("notes", seed.notes);
    navigate(`/plan?${qs.toString()}`);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top flex items-start justify-between px-5 pb-3">
        <div>
          <p className="kicker">Ask</p>
          <h1 className="serif text-[1.9rem] leading-tight font-semibold">Ask anything.</h1>
        </div>
        <div className="mt-1 flex items-center gap-3">
          {past.length > 0 && (
            <button type="button" className="text-xs text-[var(--gold)]" onClick={() => setHistoryOpen(true)}>
              History
            </button>
          )}
          {messages.length > 0 && (
            <button type="button" className="text-xs text-[var(--gold)]" onClick={startNew}>
              New chat
            </button>
          )}
        </div>
      </header>

      <div className="flight-ui">
        <FlightIssue variant="web" />
      </div>

      <div ref={scroller} className="no-scrollbar flex-1 overflow-y-auto px-5 pb-2">
        {empty && (
          <div className="rise mt-2">
            <p className="serif text-[1.7rem] leading-tight">Where should we go next?</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {ASK_IDEAS[ideaSet].map((idea) => (
                <button
                  key={idea.prompt}
                  type="button"
                  className="rounded-2xl border border-[var(--line)] bg-[rgba(20,28,47,0.55)] px-3 py-3 text-left"
                  onClick={() => send(idea.prompt)}
                >
                  <span className="block text-sm font-medium text-[var(--cream)]">{idea.title}</span>
                  <span className="mt-1 block text-xs leading-snug text-[var(--muted)]">{idea.prompt}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-xs text-[var(--gold)]"
              onClick={() => setIdeaSet((current) => (current + 1) % ASK_IDEAS.length)}
            >
              More ideas
            </button>
          </div>
        )}

        <div className="space-y-3 pb-4">
          {messages.map((m, i) => {
            const question = [...messages.slice(0, i)].reverse().find((item) => item.role === "user")?.content || "";
            return (
            <article
              key={`${m.role}-${i}`}
              className={
                m.role === "user"
                  ? "ml-8 rounded-[1.2rem] bg-[linear-gradient(180deg,#e8c99a,#c9a36a)] px-4 py-3 text-sm text-[#1a140c]"
                  : "card mr-4 rounded-[1.2rem] px-4 py-3 text-sm"
              }
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <>
                    <ChatOffers question={question} profile={profile} live={i === messages.length - 1} />
                    <RichText text={m.content} />
                    <ProductFinder question={question} saved={chats.find((item) => item.id === chatId)?.shops?.[question]} onSave={(answers) => saveShop(question, answers)} />
                  </>
                ) : (
                  <AskSteps
                    variant="app"
                    steps={replySteps(question)}
                  />
                )
              ) : (
                m.content
              )}
            </article>
            );
          })}
        </div>
        {seed && (
          <button
            type="button"
            className="mb-3 w-full rounded-2xl border border-[var(--line)] px-4 py-3 text-left"
            onClick={goPlan}
          >
            <p className="text-xs text-[var(--gold)]">Ready for days?</p>
            <p className="mt-0.5 text-sm text-[#d8d2c6]">
              {seed.q ? `Turn this into a plan for ${seed.q}` : "Turn this answer into a day-by-day plan"}
            </p>
          </button>
        )}
        {error && <p className="mb-3 text-sm text-[var(--rose)]">{error}</p>}
      </div>

      <form
        className="px-4 pb-[calc(5.35rem+env(safe-area-inset-bottom))] pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <div className="glass flex items-end gap-2 rounded-[1.4rem] px-3 py-2">
          <textarea
            rows={1}
            className="max-h-28 min-h-11 w-full resize-none bg-transparent py-2.5 text-sm outline-none placeholder:text-[#6d7588]"
            placeholder="Ask anything…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="btn-gold mb-1 rounded-xl px-3 py-2 text-xs font-semibold"
          >
            Send
          </button>
        </div>
      </form>

      {historyOpen && (
        <div className="fixed inset-0 z-[55] mx-auto flex max-w-[430px] items-end justify-center">
          <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close history" onClick={() => setHistoryOpen(false)} />
          <div className="card relative max-h-[72dvh] w-full overflow-y-auto rounded-t-[1.6rem] px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <div>
                <p className="kicker">Desk</p>
                <h2 className="serif text-2xl font-semibold">Past chats</h2>
              </div>
              <button type="button" className="text-xs text-[var(--gold)]" onClick={startNew}>
                New chat
              </button>
            </div>
            {past.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">Nothing saved yet. Ask something and it will live here.</p>
            ) : (
              <div className="mt-4 space-y-2">
                {past.map((chat) => (
                  <div key={chat.id} className="flex items-stretch gap-2">
                    <button
                      type="button"
                      className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-left ${
                        chat.id === chatId ? "border-[var(--gold)]" : "border-[var(--line)]"
                      }`}
                      onClick={() => loadChat(chat)}
                    >
                      <p className="line-clamp-2 text-sm text-[#d8d2c6]">{chatPreview(chat)}</p>
                      <p className="mt-1 text-[0.7rem] text-[var(--muted)]">{timeAgo(chat.updatedAt)}</p>
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-[var(--line)] px-3 text-xs text-[var(--rose)]"
                      onClick={() => setPendingDelete(chat.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this chat?"
        body="It will disappear from this phone and your signed-in account."
        confirmLabel="Delete chat"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete;
          setPendingDelete(null);
          removeChat(id);
          if (id === chatId) startNew();
        }}
      />
    </div>
  );
}

function ChatOffers({ question, profile, live }) {
  const offer = readOffer(question);
  const [picks, setPicks] = useState(null);
  const [note, setNote] = useState("");
  const [liveFares, setLiveFares] = useState(false);
  const flight = Boolean(offer?.modes?.includes("flight") && offer.from && offer.to);

  useEffect(() => {
    if (!live || !flight) return undefined;
    let cancel = false;
    setNote("Choosing flights…");
    suggestFlights({
      from: offer.from,
      to: offer.to,
      date: tomorrowIso(),
      adults: 1,
      kids: 0,
      currency: profile?.currency || "INR",
      profile,
    })
      .then((next) => {
        if (cancel) return;
        setPicks(Array.isArray(next) ? next.slice(0, 3) : []);
        setNote("");
      })
      .catch(() => {
        if (!cancel) setNote("");
      });
    return () => {
      cancel = true;
    };
  }, [live, flight, offer?.from, offer?.to, profile?.currency]);

  if (!offer) return null;
  const board = offer?.from && offer.to && offer.modes.length
    ? buildJourney({
        from: offer.from,
        to: offer.to,
        date: tomorrowIso(),
        adults: 1,
        kids: 0,
        modes: offer.modes,
        flightPicks: picks,
        currency: profile?.currency || "INR",
        profile,
      })
    : null;
  const stays = offer ? STAY_STANDARDS.filter((item) => offer.stayIds.includes(item.id)) : [];
  const food = offer?.foodCity ? placeLinks({ name: offer.foodCity }, offer.foodCity) : null;
  const sights = offer?.sightCity
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`things to do in ${offer.sightCity}`)}`
    : "";
  const flightSearch = board
    ? `https://www.google.com/travel/flights/search?q=${encodeURIComponent(`One way flights from ${board.from} to ${board.to}`)}`
    : "";

  return (
    <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
      <p className="kicker">{offer ? "Book" : "Buy"}</p>
      {note && !liveFares ? <p className="text-xs text-[var(--muted)]">{note}</p> : null}
      {flight ? (
        <div className="flight-ui">
          <FlightBook frame="phone" variant="web" question={question} from={offer.from} to={offer.to} date={tomorrowIso()} onLive={setLiveFares} />
        </div>
      ) : null}
      {offer && board?.options.filter((option) => !(liveFares && option.id === "flight")).map((option) => {
        const partners = option.partners || [];
        const featured = ["makemytrip", "goibibo"]
          .map((id) => partners.find((item) => item.id === id))
          .filter(Boolean);
        const primary = partners.find((item) => item.primary) || partners[0];
        const rest = partners.filter((item) => item !== primary && !featured.includes(item));
        const href = primary?.href || (option.id === "flight" ? flightSearch : "");
        return (
          <div key={option.id} className="rounded-2xl border border-[var(--line)] px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium">{option.label}</p>
              {option.price ? <p className="text-xs text-[var(--gold-bright)]">{option.price}</p> : null}
            </div>
            {featured.map((item) => (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-xs font-medium text-[var(--gold-bright)]"
              >
                {item.name}
              </a>
            ))}
            {option.picks?.length ? (
              <div className="mt-2 space-y-1.5">
                {option.picks.map((pick) => (
                  <a
                    key={`${pick.airline}-${pick.fareLow}`}
                    href={pick.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span>{pick.airline}</span>
                    <span className="text-[var(--gold-bright)]">{pick.typicalFare || "See flight"}</span>
                  </a>
                ))}
              </div>
            ) : href && !featured.includes(primary) ? (
              <a href={href} target="_blank" rel="noreferrer" className="mt-2 block text-xs font-medium text-[var(--gold-bright)]">
                {primary?.action || "See flights"}
              </a>
            ) : null}
            {rest.map((item) => (
              <a
                key={item.id || item.name}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block text-xs font-medium text-[var(--gold-bright)]"
              >
                {item.name}
              </a>
            ))}
          </div>
        );
      })}
      {offer?.stayCity
        ? STAY_PARTNERS.map((partner) => (
            <OfferLink
              key={partner.id}
              href={partner.href}
              title={partner.name}
              detail={`Opens ${partner.name}. Search ${offer.stayCity} there.`}
              action="See stays"
            />
          ))
        : null}
      {offer ? stays.map((item) => {
        const href = staySearchUrl({ id: item.id, destination: offer.stayCity, startDate: tomorrowIso(), adults: 1 });
        if (!href) return null;
        return (
          <a key={item.id} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-3 py-2.5">
            <span>
              <span className="block text-sm">{item.label}</span>
              <span className="mt-0.5 block text-[0.65rem] text-[var(--muted)]">{item.search} in {offer.stayCity}</span>
            </span>
            <span className="shrink-0 text-xs text-[var(--gold-bright)]">See stays</span>
          </a>
        );
      }) : null}
      {food ? (
        <>
          <OfferLink href={food.zomato} title="Restaurants" detail={`Food in ${offer.foodCity}`} action="See on Zomato" />
          <OfferLink href={food.maps} title="Places to eat" detail={`Maps search in ${offer.foodCity}`} action="Open Maps" />
        </>
      ) : null}
      {sights ? <OfferLink href={sights} title="Things to do" detail={`Sights in ${offer.sightCity}`} action="Open Maps" /> : null}
    </div>
  );
}

function OfferLink({ href, title, detail, action }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-3 py-2.5">
      <span>
        <span className="block text-sm">{title}</span>
        <span className="mt-0.5 block text-[0.65rem] text-[var(--muted)]">{detail}</span>
      </span>
      <span className="shrink-0 text-xs text-[var(--gold-bright)]">{action}</span>
    </a>
  );
}
