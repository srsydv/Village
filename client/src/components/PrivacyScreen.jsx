import { useState } from "react";
import { Link } from "react-router-dom";
import { deleteAccount } from "../lib/api.js";
import { CURRENCY_OPTIONS } from "../lib/profileOptions.js";
import { useTravel } from "../lib/TravelContext.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { DestinationSuggest } from "./DestinationSuggest.jsx";
import { PassportSelect } from "./PassportSelect.jsx";

export function PrivacyScreen() {
  const { profile, updateProfile, account, signOut } = useTravel();
  const [confirmOut, setConfirmOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="safe-top safe-bottom px-5">
      <Link to="/" className="text-sm text-[var(--gold)]">
        ← Home
      </Link>
      <p className="kicker mt-5">You</p>
      <h1 className="serif mt-1 text-[2.1rem] font-semibold">Profile</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Used for budgets, visas, and “departing from” in every plan.</p>

      <div className="card mt-6 rounded-[1.4rem] p-4">
        <div className="flex items-center gap-3">
          {account?.picture ? (
            <img src={account.picture} alt="" className="h-11 w-11 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-sm text-[var(--gold-bright)]">
              {(account?.name || profile.name || "A").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[var(--cream)]">{account?.name || profile.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">{account?.email}</p>
          </div>
        </div>
        <button
          type="button"
          className="mt-4 w-full rounded-2xl border border-[var(--rose)] py-3 text-sm font-semibold text-[var(--rose)]"
          onClick={() => setConfirmOut(true)}
        >
          Log out
        </button>
        <button
          type="button"
          className="mt-2 w-full py-2 text-sm text-[var(--rose)]"
          onClick={() => {
            setDeleteError("");
            setConfirmDelete(true);
          }}
        >
          Delete account
        </button>
        {deleteError && <p className="mt-2 text-xs text-[var(--rose)]">{deleteError}</p>}
        {account?.isAdmin && (
          <Link
            to="/admin"
            className="mt-3 block w-full rounded-2xl border border-[var(--line)] py-3 text-center text-sm font-semibold text-[var(--gold-bright)]"
          >
            Analysis & user activity
          </Link>
        )}
      </div>

      <div className="mt-6 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Name</span>
          <input className="field" value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Home city</span>
          <DestinationSuggest
            value={profile.homeCity || ""}
            placeholder="Mumbai, Maharashtra, India"
            onChange={(homeCity) => updateProfile({ homeCity })}
            onSelect={(place) => {
              if (place?.label) updateProfile({ homeCity: place.label });
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Currency</span>
          <select
            className="field"
            value={profile.currency}
            onChange={(e) => updateProfile({ currency: e.target.value })}
          >
            {CURRENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[0.7rem] uppercase tracking-wide text-[var(--muted)]">Passport</span>
          <PassportSelect
            value={profile.nationality || "India"}
            onChange={(nationality) => updateProfile({ nationality })}
          />
          <span className="mt-1.5 block text-xs text-[var(--muted)]">Visa answers use this, not your home city.</span>
        </label>
      </div>

      <section className="card mt-8 rounded-[1.4rem] p-4 text-sm leading-relaxed text-[#d8d2c6]">
        <p className="kicker">Privacy</p>
        <p className="mt-3">
          Safar sends your questions and plan details to our server, then to Google Gemini, so it can answer. Hotel,
          restaurant, and sight lookups go to OpenStreetMap. Weather comes from Open-Meteo. You must sign in with
          Google to use Safar. We store your email, name, chats, and saved trips so they reload on another device. Log
          out from Profile. We also keep an activity log, and plan searches (destination, dates, budget) even if you do
          not save the trip. The operator can review chats to run Safar.
        </p>
        <p className="mt-3">
          Clearing site data deletes the copy on this phone. Your signed-in trips and chats still reload after you sign
          in again unless you delete the account. Delete account on this screen removes your profile, chats, and trips
          from Safar. Share a trip first if you want a copy outside the app. We do not sell personal data. Do not share
          passport numbers, card details, or passwords in chat.
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Safar explains visa steps. You apply yourself on the official site. We do not file visas. Plans are AI-generated
          and can be wrong.
        </p>
        <Link to="/privacy" className="mt-4 inline-block text-sm text-[var(--gold)]">
          Full privacy policy
        </Link>
      </section>

      <ConfirmDialog
        open={confirmOut}
        title="Log out?"
        body="This phone will forget the session. Your trips and chats stay on your account and come back when you sign in."
        confirmLabel="Log out"
        danger
        onCancel={() => setConfirmOut(false)}
        onConfirm={signOut}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this account?"
        body="Safar will erase your profile, chats, and saved trips from this phone and our server. This cannot be undone."
        confirmLabel={deleting ? "Deleting…" : "Delete account"}
        danger
        onCancel={() => !deleting && setConfirmDelete(false)}
        onConfirm={async () => {
          if (deleting) return;
          setDeleting(true);
          setDeleteError("");
          try {
            await deleteAccount();
            signOut();
          } catch (err) {
            setDeleteError(err.message || "Could not delete this account.");
            setDeleting(false);
            setConfirmDelete(false);
          }
        }}
      />
    </div>
  );
}
