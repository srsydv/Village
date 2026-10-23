import { useEffect, useState } from "react";
import {
  fetchOutgoingShares,
  lookupShareUser,
  shareTripWithUser,
  unshareTrip,
} from "../lib/api.js";
import { shareApp, shareTrip } from "../lib/tripText.js";

export function ShareTripSheet({ open, trip, username, onClose }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [shares, setShares] = useState([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !trip?.id) return undefined;
    let cancel = false;
    fetchOutgoingShares(trip.id)
      .then((rows) => {
        if (!cancel) setShares(rows);
      })
      .catch(() => {
        if (!cancel) setShares([]);
      });
    return () => {
      cancel = true;
    };
  }, [open, trip?.id]);

  if (!open) return null;

  const findPerson = async () => {
    setError("");
    setNote("");
    setResult(null);
    setSearching(true);
    try {
      const data = await lookupShareUser(query);
      setResult(data);
    } catch (err) {
      setError(err.message || "Could not search.");
    } finally {
      setSearching(false);
    }
  };

  const shareWith = async () => {
    if (!result?.user?.id) return;
    setBusy(true);
    setError("");
    try {
      const share = await shareTripWithUser({ tripId: trip.id, userId: result.user.id });
      setShares((current) => {
        const rest = current.filter((item) => item.user?.id !== share.user?.id);
        return [share, ...rest];
      });
      setNote(`Shared with ${result.user.name || `@${result.user.username}`}`);
      setResult(null);
      setQuery("");
    } catch (err) {
      setError(err.message || "Could not share this trip.");
    } finally {
      setBusy(false);
    }
  };

  const stopSharing = async (id) => {
    setError("");
    try {
      await unshareTrip(id);
      setShares((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message || "Could not stop sharing.");
    }
  };

  const sendOutside = async (kind) => {
    setError("");
    setNote("");
    try {
      const outcome = kind === "app" ? await shareApp({ username }) : await shareTrip(trip);
      if (outcome === "cancelled") return;
      setNote(outcome === "copied" ? "Copied" : kind === "app" ? "Invite ready to send" : "Shared");
    } catch (err) {
      setError(err.message || "Could not share.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end justify-center px-4 pb-[calc(5.8rem+env(safe-area-inset-bottom))]">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close" onClick={onClose} />
      <div className="card relative max-h-[78dvh] w-full overflow-y-auto rounded-[1.5rem] p-5">
        <h2 className="serif text-2xl font-semibold">Share this trip</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          They’ll see this itinerary. Your checklist stays private.
        </p>

        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!searching && query.trim()) findPerson();
          }}
        >
          <input
            className="field"
            placeholder="Username, email, or phone"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setResult(null);
            }}
          />
          <button
            type="submit"
            className="btn-gold mt-3 w-full rounded-2xl py-3 text-sm font-semibold"
            disabled={searching || !query.trim()}
          >
            {searching ? "Looking…" : "Find on Safar"}
          </button>
        </form>

        {result?.self && <p className="mt-3 text-sm text-[var(--muted)]">That’s your account.</p>}
        {result && !result.found && !result.self && (
          <div className="mt-4">
            <p className="text-sm text-[var(--muted)]">They’re not on Safar yet.</p>
            <button
              type="button"
              className="mt-3 w-full rounded-2xl border border-[var(--line)] py-2.5 text-sm text-[#d8d2c6]"
              onClick={() => sendOutside("app")}
            >
              Invite them
            </button>
          </div>
        )}
        {result?.found && result.user && (
          <div className="mt-4">
            <PersonRow person={result.user} />
            <button
              type="button"
              className="btn-gold mt-3 w-full rounded-2xl py-3 text-sm font-semibold"
              disabled={busy}
              onClick={shareWith}
            >
              {busy ? "Sharing…" : "Share trip"}
            </button>
          </div>
        )}

        {shares.length > 0 && (
          <div className="mt-5">
            <p className="kicker">Shared with</p>
            <div className="mt-2">
              {shares.map((share) => (
                <PersonRow
                  key={share.id}
                  person={share.user}
                  action={
                    <button type="button" className="text-xs text-[var(--rose)]" onClick={() => stopSharing(share.id)}>
                      Remove
                    </button>
                  }
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <p className="text-xs text-[var(--muted)]">Or send it outside Safar. The message includes the Play Store link.</p>
          <button
            type="button"
            className="mt-3 w-full rounded-2xl border border-[var(--line)] py-2.5 text-sm text-[#d8d2c6]"
            onClick={() => sendOutside("trip")}
          >
            Share plan
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-2xl border border-[var(--line)] py-2.5 text-sm text-[#d8d2c6]"
            onClick={() => sendOutside("app")}
          >
            Invite friends to download Safar
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-[var(--rose)]">{error}</p>}
        {note && <p className="mt-3 text-xs text-[var(--gold)]">{note}</p>}
        <button type="button" className="mt-2 w-full py-2.5 text-sm text-[var(--muted)]" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function PersonRow({ person, action }) {
  if (!person) return null;
  const initial = (person.name || person.username || "S").slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 py-2">
      {person.picture ? (
        <img src={person.picture} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] text-sm text-[var(--gold-bright)]">
          {initial}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-[var(--cream)]">{person.name || "Safar member"}</p>
        {person.username ? <p className="truncate text-xs text-[var(--muted)]">@{person.username}</p> : null}
      </div>
      {action}
    </div>
  );
}
