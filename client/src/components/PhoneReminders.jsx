import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addTripsToPhoneCalendar,
  disablePhoneReminders,
  enablePhoneReminders,
  listenForReminderOpens,
  phoneRemindersOn,
  remindersAvailable,
  syncPhoneReminders,
  upcomingReminderCount,
} from "../lib/phoneReminders.js";
import { useTravel } from "../lib/TravelContext.jsx";

export function PhoneReminderSync() {
  const { trips, ready } = useTravel();
  const navigate = useNavigate();

  useEffect(() => {
    return listenForReminderOpens((extra) => {
      if (extra?.day) navigate(`/trips?day=${encodeURIComponent(extra.day)}`);
      else if (extra?.tripId) navigate(`/trips/${extra.tripId}`);
    });
  }, [navigate]);

  useEffect(() => {
    if (!ready || !phoneRemindersOn()) return undefined;
    syncPhoneReminders(trips).catch(() => {});
    return undefined;
  }, [ready, trips]);

  return null;
}

export function PhoneReminders({ trips }) {
  const [on, setOn] = useState(phoneRemindersOn);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const count = upcomingReminderCount(trips);
  const native = remindersAvailable();

  const toggle = async () => {
    setBusy(true);
    setNote("");
    try {
      if (on) {
        await disablePhoneReminders();
        setOn(false);
        setNote("Reminders removed from this phone.");
        return;
      }
      const result = await enablePhoneReminders(trips);
      if (result.ok) {
        setOn(true);
        setNote(
          result.count
            ? `${result.count} reminder${result.count === 1 ? "" : "s"} set on this phone.`
            : "On. A dated trip will remind this phone.",
        );
        return;
      }
      if (result.reason === "denied") {
        setNote("Notifications are off for Safar. Allow them in your phone settings, then turn this on again.");
        return;
      }
      setNote("The Safar app keeps these reminders after you close it. You can still add the days to your phone calendar.");
    } catch (err) {
      setNote(err.message || "Could not update reminders.");
    } finally {
      setBusy(false);
    }
  };

  const addCalendar = async () => {
    setBusy(true);
    setNote("");
    try {
      const result = await addTripsToPhoneCalendar(trips);
      if (result === "cancelled") return;
      setNote(result === "shared" ? "Choose Calendar from the share sheet." : "Open the calendar file to add these days.");
    } catch (err) {
      setNote(err.message || "Could not add the calendar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card mt-4 rounded-2xl px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Phone reminders</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {native
              ? "The evening before you leave, and at 8:00 on each morning of the plan."
              : "The evening before you leave, and at 8:00 on each morning of the plan. The installed Safar app delivers them."}
            {count ? ` ${count} coming up.` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          aria-pressed={on}
          onClick={toggle}
          className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold ${on ? "btn-gold" : "border border-[var(--line)] text-[var(--gold-bright)]"}`}
        >
          {on ? "On" : "Off"}
        </button>
      </div>
      <button type="button" disabled={busy} onClick={addCalendar} className="mt-3 block py-2 text-left text-sm text-[var(--gold)]">
        Add dated trips to your phone calendar
      </button>
      {note ? <p className="mt-1 text-xs text-[var(--muted)]">{note}</p> : null}
    </section>
  );
}
