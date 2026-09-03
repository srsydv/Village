import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { askAurea } from "../lib/api.js";
import { QUICK_ASKS } from "../lib/destinations.js";
import { RichText } from "../lib/richtext.jsx";
import { getChats, uid } from "../lib/storage.js";
import { useTravel } from "../lib/TravelContext.jsx";

export function ChatScreen() {
  const { profile, addChat } = useTravel();
  const [params, setParams] = useSearchParams();
  const incoming = params.get("q") || "";
  const [chatId] = useState(() => getChats()[0]?.id || uid());
  const [messages, setMessages] = useState(() => getChats()[0]?.messages || []);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scroller = useRef(null);
  const asked = useRef(false);

  const persist = (next) => {
    setMessages(next);
    addChat({ id: chatId, updatedAt: Date.now(), messages: next });
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
      const full = await askAurea({
        messages: next,
        profile,
        onDelta: (_delta, all) => {
          persist([...next, { role: "assistant", content: all }]);
        },
      });
      persist([...next, { role: "assistant", content: full }]);
    } catch (err) {
      setError(err.message || "Aurea could not reply.");
      persist(next);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!incoming || asked.current) return;
    asked.current = true;
    setParams({}, { replace: true });
    send(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const empty = messages.length === 0 && !busy;

  const chips = useMemo(() => QUICK_ASKS.slice(0, 4), []);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top px-5 pb-3">
        <p className="kicker">Concierge</p>
        <h1 className="serif text-[1.9rem] leading-tight font-semibold">Ask Aurea anything.</h1>
      </header>

      <div ref={scroller} className="no-scrollbar flex-1 overflow-y-auto px-5 pb-2">
        {empty && (
          <div className="rise card mt-2 rounded-[1.5rem] p-5">
            <p className="serif text-2xl">Your private desk is open.</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Destinations, expenses, hotels, visas, packing, weather, food — ask in your own words.
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
            placeholder="Hotels in Kyoto under ₹12,000…"
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
    </div>
  );
}
