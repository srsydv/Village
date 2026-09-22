import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { askSafar } from "../lib/api.js";
import { chatPreview, planSeedFromChat } from "../lib/chatHints.js";
import { timeAgo } from "../lib/dates.js";
import { QUICK_ASKS } from "../lib/destinations.js";
import { RichText } from "../lib/richtext.jsx";
import { uid } from "../lib/storage.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";

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
  const scroller = useRef(null);
  const asked = useRef(false);

  const persist = (next, id = chatId) => {
    setMessages(next);
    addChat({ id, updatedAt: Date.now(), messages: next });
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
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const empty = messages.length === 0 && !busy;
  const chips = useMemo(() => QUICK_ASKS.slice(0, 4), []);
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
          <p className="kicker">Concierge</p>
          <h1 className="serif text-[1.9rem] leading-tight font-semibold">Ask a question.</h1>
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

      <div ref={scroller} className="no-scrollbar flex-1 overflow-y-auto px-5 pb-2">
        {empty && (
          <div className="rise card mt-2 rounded-[1.5rem] p-5">
            <p className="serif text-2xl">Your private desk is open.</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Short questions — visas, budgets, packing. For a full itinerary, use Plan.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[#d8d2c6]"
                  onClick={() => send(c.prompt)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 pb-4">
          {messages.map((m, i) => (
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
                  <RichText text={m.content} />
                ) : (
                  <p className="typing text-[var(--gold-bright)]">
                    <span>●</span> <span>●</span> <span>●</span>
                  </p>
                )
              ) : (
                m.content
              )}
            </article>
          ))}
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
            placeholder={
              profile.currency === "INR" ? "Hotels in Kyoto under ₹12,000…" : "Hotels in Kyoto under 150 a night…"
            }
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
                <h2 className="serif text-2xl font-semibold">Past questions</h2>
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
