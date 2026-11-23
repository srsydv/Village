import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  askSafar,
  checkUsername,
  createPlan,
  fetchAdminOverview,
  fetchAdminUser,
  fetchAdminUsers,
  fetchAuthConfig,
  signInWithGoogleCredential,
  suggestFlights,
  suggestPlaces,
} from "../../lib/api.js";
import { ASK_IDEAS, readOffer } from "../../lib/askOffers.js";
import { formatTripSpan, tomorrowIso, travelerLine, tripEndIso } from "../../lib/dates.js";
import { placeLinks, PLAY_STORE_URL } from "../../lib/links.js";
import { CURRENCY_OPTIONS, PASSPORT_OPTIONS } from "../../lib/profileOptions.js";
import { RichText } from "../../lib/richtext.jsx";
import { budgetLabel } from "../../lib/styleBudget.js";
import { STAY_STANDARDS, staySearchUrl, toggleStay } from "../../lib/stays.js";
import { uid } from "../../lib/storage.js";
import { buildJourney, TRANSPORT_MODES } from "../../lib/transport.js";
import { useTravel } from "../../lib/TravelContext.jsx";
import "./try.css";

export function TrySafar() {
  const travel = useTravel();

  useEffect(() => {
    const previous = document.title;
    document.title = "Safar";
    return () => {
      document.title = previous;
    };
  }, []);

  if (!travel.authChecked) {
    return (
      <div className="web web-wait">
        <p>Safar</p>
      </div>
    );
  }
  if (!travel.signedIn) return <SignIn onSignedIn={travel.completeGoogleSignIn} />;
  if (!travel.ready) return <Setup travel={travel} />;
  return <Desk travel={travel} />;
}

function SignIn({ onSignedIn }) {
  const slot = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const config = await fetchAuthConfig();
        if (cancelled) return;
        if (!config.enabled || !config.googleClientId) {
          setError("Google Sign-In is not configured on the server.");
          return;
        }
        await loadGis();
        if (cancelled || !slot.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async (response) => {
            setError("");
            try {
              const data = await signInWithGoogleCredential(response.credential, { client: "web" });
              onSignedIn(data);
            } catch (err) {
              setError(err.message || "Google sign-in failed.");
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: false,
        });
        window.google.accounts.id.renderButton(slot.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 320,
        });
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err.message || "Google Sign-In could not start.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onSignedIn]);

  return (
    <div className="web web-gate">
      <Link to="/" className="web-mark">
        Safar
      </Link>
      <h1>Sign in to your trips.</h1>
      <p>The same account as the app. A question you ask here is on your phone, and a trip you save here is there too.</p>
      <div ref={slot} className="web-google" />
      {!ready && !error ? <p className="web-note">Loading Google…</p> : null}
      {error ? <p className="web-error">{error}</p> : null}
      <a className="web-quiet" href={PLAY_STORE_URL}>
        Get the app
      </a>
    </div>
  );
}

function Setup({ travel }) {
  const { account, profile, completeOnboarding, signOut } = travel;
  const [name, setName] = useState(profile.name || account?.name || "");
  const [homeCity, setHomeCity] = useState(profile.homeCity || "");
  const [currency, setCurrency] = useState(profile.currency || "INR");
  const [nationality, setNationality] = useState(profile.nationality || "India");
  const [username, setUsername] = useState(profile.username || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [usernameNote, setUsernameNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    const q = username.trim().replace(/^@+/, "");
    if (q.length < 3) {
      setUsernameNote("");
      return undefined;
    }
    let cancel = false;
    const timer = setTimeout(() => {
      checkUsername(q)
        .then((result) => {
          if (!cancel) setUsernameNote(result.error || (result.available ? "Available" : "That username is taken."));
        })
        .catch(() => {});
    }, 400);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [username]);

  useEffect(() => {
    const q = homeCity.trim();
    if (q.length < 2) {
      setCities([]);
      return undefined;
    }
    let cancel = false;
    const timer = setTimeout(() => {
      suggestPlaces(q)
        .then((places) => {
          if (!cancel) setCities(Array.isArray(places) ? places.slice(0, 5) : []);
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [homeCity]);

  const canContinue = Boolean(
    name.trim() && homeCity.trim() && username.trim().replace(/^@+/, "").length >= 3 && phone.replace(/\D/g, "").length >= 10,
  );

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await completeOnboarding({
        name: name.trim(),
        homeCity: homeCity.trim(),
        currency,
        nationality,
        username: username.trim(),
        phone: phone.trim(),
      });
    } catch (err) {
      setError(err.message || "Could not save your profile.");
      setSaving(false);
    }
  };

  return (
    <div className="web web-gate">
      <p className="web-kicker">Signed in as {account?.email}</p>
      <h1>Who is travelling?</h1>
      <p>This is the same profile the app uses. Friends find you by the username.</p>
      <form
        className="web-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canContinue) save();
        }}
      >
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))}
          placeholder="Username"
          autoCapitalize="none"
        />
        {usernameNote ? <p className="web-note">{usernameNote}</p> : null}
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" inputMode="tel" />
        <input value={homeCity} onChange={(event) => setHomeCity(event.target.value)} placeholder="Home city" />
        {cities.length ? (
          <div className="web-hits">
            {cities.map((place) => (
              <button
                key={place.id || place.label}
                type="button"
                onClick={() => {
                  setHomeCity(place.label || place.name || "");
                  setCities([]);
                }}
              >
                {place.label || place.name}
              </button>
            ))}
          </div>
        ) : null}
        <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
          {CURRENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select value={nationality} onChange={(event) => setNationality(event.target.value)}>
          {PASSPORT_OPTIONS.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
        {error ? <p className="web-error">{error}</p> : null}
        <button type="submit" className="web-solid" disabled={!canContinue || saving}>
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
      <button type="button" className="web-quiet" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}

function Desk({ travel }) {
  const { profile, account, chats, trips, addChat, addTrip, signOut } = travel;
  const [section, setSection] = useState("ask");
  const [chatId, setChatId] = useState("");
  const [tripId, setTripId] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const threadRef = useRef(null);
  const chat = chats.find((item) => item.id === chatId);
  const messages = chat?.messages || [];
  const trip = trips.find((item) => item.id === tripId);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, busy]);

  const openChat = (id) => {
    setChatId(id);
    setSection("ask");
    setError("");
  };

  const send = async (raw) => {
    const content = String(raw || "").trim();
    if (!content || busy) return;
    setDraft("");
    setError("");
    const id = chatId || uid();
    const next = [...messages, { role: "user", content }];
    setChatId(id);
    addChat({ id, updatedAt: Date.now(), messages: next });
    setBusy(true);
    try {
      const full = await askSafar({
        messages: next,
        profile,
        onDelta: (_delta, all) => {
          addChat({ id, updatedAt: Date.now(), messages: [...next, { role: "assistant", content: all }] });
        },
      });
      addChat({ id, updatedAt: Date.now(), messages: [...next, { role: "assistant", content: full }] });
    } catch (err) {
      setError(err.message || "Safar could not reply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="web">
      <aside className="web-rail">
        <div className="web-rail-top">
          <Link to="/" className="web-mark">
            Safar
          </Link>
          <button type="button" className="web-solid" onClick={() => openChat("")}>
            New question
          </button>
          <button type="button" className={section === "plan" ? "web-ghost is-on" : "web-ghost"} onClick={() => setSection("plan")}>
            Plan a trip
          </button>
        </div>
        <div className="web-rail-scroll">
          <p className="web-kicker">Questions</p>
          {chats.filter((item) => item.messages?.length).slice(0, 6).map((item) => (
            <button key={item.id} type="button" className={section === "ask" && item.id === chatId ? "web-item is-on" : "web-item"} onClick={() => openChat(item.id)}>
              {preview(item)}
            </button>
          ))}
          <p className="web-kicker">Trips</p>
          {trips.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === "trip" && item.id === tripId ? "web-item is-on" : "web-item"}
              title={item.plan?.destination || item.plan?.title || "Trip"}
              onClick={() => {
                setTripId(item.id);
                setSection("trip");
              }}
            >
              {placeName(item)}
            </button>
          ))}
        </div>
        <div className="web-account">
          {account?.isAdmin ? (
            <button type="button" className={section === "people" ? "web-item is-on" : "web-item"} onClick={() => setSection("people")}>
              People
            </button>
          ) : null}
          <strong>{profile.name || "Signed in"}</strong>
          <span>{account?.email}</span>
          <div>
            <button type="button" onClick={signOut}>
              Sign out
            </button>
            <a href={PLAY_STORE_URL}>Get the app</a>
          </div>
        </div>
      </aside>
      <main className="web-main">
        {section === "ask" ? (
          <Ask
            messages={messages}
            busy={busy}
            error={error}
            draft={draft}
            setDraft={setDraft}
            onSend={send}
            threadRef={threadRef}
            profile={profile}
          />
        ) : null}
        {section === "plan" ? (
          <PlanForm
            profile={profile}
            onSaved={(saved) => {
              addTrip(saved);
              setTripId(saved.id);
              setSection("trip");
            }}
          />
        ) : null}
        {section === "trip" ? <TripView trip={trip} profile={profile} onUpdate={addTrip} /> : null}
        {section === "people" && account?.isAdmin ? <People /> : null}
      </main>
    </div>
  );
}

function Ask({ messages, busy, error, draft, setDraft, onSend, threadRef, profile }) {
  const [ideaSet, setIdeaSet] = useState(0);
  const empty = messages.length === 0;
  const compose = (
    <form
      className="web-compose"
      onSubmit={(event) => {
        event.preventDefault();
        onSend(draft);
      }}
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={empty ? "A quiet weekend from Delhi" : "Ask Safar"}
        aria-label="Ask Safar"
      />
      <button type="submit" className="web-solid" disabled={!draft.trim() || busy}>
        Send
      </button>
    </form>
  );

  return (
    <section className={empty ? "web-ask is-empty" : "web-ask"}>
      {empty ? null : (
        <header>
          <h1>Ask Safar</h1>
        </header>
      )}
      <div className={empty ? "web-thread is-empty" : "web-thread"} ref={threadRef}>
        {empty ? (
          <div className="web-hello">
            <h1>Where should we go next?</h1>
            {compose}
            <div className="web-ideas">
              {ASK_IDEAS[ideaSet].map((idea) => (
                <button key={idea.prompt} type="button" className="web-idea" onClick={() => onSend(idea.prompt)}>
                  <IdeaIcon name={idea.icon} />
                  <strong>{idea.title}</strong>
                  <span>{idea.prompt}</span>
                </button>
              ))}
            </div>
            <button type="button" className="web-more" onClick={() => setIdeaSet((current) => (current + 1) % ASK_IDEAS.length)}>
              More ideas
            </button>
          </div>
        ) : (
          messages.map((message, index) =>
            message.role === "user" ? (
              <p key={`${index}-you`} className="web-you">
                {message.content}
              </p>
            ) : (
              <div key={`${index}-safar`} className="web-safar">
                <RichText text={message.content} />
                <AskOffers
                  question={[...messages.slice(0, index)].reverse().find((item) => item.role === "user")?.content || ""}
                  profile={profile}
                />
              </div>
            ),
          )
        )}
        {busy ? <p className="web-note">Safar is writing…</p> : null}
        {error ? <p className="web-error">{error}</p> : null}
      </div>
      {empty ? null : compose}
    </section>
  );
}

function AskOffers({ question, profile }) {
  const offer = readOffer(question);
  const [picks, setPicks] = useState(null);
  const [note, setNote] = useState("");
  const flight = Boolean(offer?.modes?.includes("flight") && offer.from && offer.to);

  useEffect(() => {
    if (!flight) return undefined;
    let cancel = false;
    setPicks(null);
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
  }, [flight, offer?.from, offer?.to, profile?.currency]);

  if (!offer) return null;
  const board = offer.from && offer.to && offer.modes.length
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
  const stays = STAY_STANDARDS.filter((item) => offer.stayIds.includes(item.id));
  const food = offer.foodCity ? placeLinks({ name: offer.foodCity }, offer.foodCity) : null;
  const sights = offer.sightCity
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`things to do in ${offer.sightCity}`)}`
    : "";

  return (
    <div className="web-offers">
      <p className="web-kicker">Book</p>
      {note ? <p className="web-note">{note}</p> : null}
      {board
        ? board.options.map((option) => (
            <FareCard
              key={option.id}
              option={option}
              fallbackHref={
                option.id === "flight" && !option.picks?.length
                  ? `https://www.google.com/travel/flights/search?q=${encodeURIComponent(`One way flights from ${board.from} to ${board.to}`)}`
                  : ""
              }
            />
          ))
        : null}
      {stays.map((item) => {
        const href = staySearchUrl({
          id: item.id,
          destination: offer.stayCity,
          startDate: tomorrowIso(),
          adults: 1,
        });
        if (!href) return null;
        return (
          <a key={item.id} className="web-stay-link" href={href} target="_blank" rel="noreferrer">
            <span>
              <strong>{item.label}</strong>
              <small>{item.search} in {offer.stayCity}</small>
            </span>
            <em>See stays</em>
          </a>
        );
      })}
      {food ? (
        <>
          <a className="web-stay-link" href={food.zomato} target="_blank" rel="noreferrer">
            <span>
              <strong>Restaurants</strong>
              <small>Food in {offer.foodCity}</small>
            </span>
            <em>See on Zomato</em>
          </a>
          <a className="web-stay-link" href={food.maps} target="_blank" rel="noreferrer">
            <span>
              <strong>Places to eat</strong>
              <small>Maps search in {offer.foodCity}</small>
            </span>
            <em>Open Maps</em>
          </a>
        </>
      ) : null}
      {sights ? (
        <a className="web-stay-link" href={sights} target="_blank" rel="noreferrer">
          <span>
            <strong>Things to do</strong>
            <small>Sights in {offer.sightCity}</small>
          </span>
          <em>Open Maps</em>
        </a>
      ) : null}
    </div>
  );
}

function IdeaIcon({ name }) {
  const common = { viewBox: "0 0 24 24", width: "18", height: "18", fill: "none", stroke: "currentColor", strokeWidth: "1.7", "aria-hidden": "true" };
  if (name === "bed") {
    return (
      <svg {...common}>
        <path d="M3 18V8M3 14h18v4M7 14V10h6v4M21 18V11a2 2 0 0 0-2-2h-3" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "place") {
    return (
      <svg {...common}>
        <path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "ticket") {
    return (
      <svg {...common}>
        <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" strokeLinejoin="round" />
        <path d="M12 7v10" strokeDasharray="2 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5M12 4V2M12 22v-2M4 12H2M22 12h-2" strokeLinecap="round" />
    </svg>
  );
}

const TRIP_STYLES = ["Balanced", "Luxury", "Budget", "Adventure", "Family", "Honeymoon"];

function PlanForm({ profile, onSaved }) {
  const [form, setForm] = useState({
    origin: profile.homeCity || "",
    destination: "",
    startDate: tomorrowIso(),
    days: "6",
    adults: 2,
    kids: 0,
    budget: "",
    style: "Balanced",
    interests: "",
    notes: "",
    modes: [],
    stays: [],
  });
  const [originPlace, setOriginPlace] = useState(null);
  const [pickedPlace, setPickedPlace] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!form.destination.trim() || busy) return;
    if (form.modes.length && !form.origin.trim()) {
      setError("Add the city you are leaving from so Safar can compare train, flight, and bus fares.");
      return;
    }
    setBusy(true);
    setError("");
    setPhase("Looking up that place…");
    try {
      let place = pickedPlace;
      if (!place?.label) {
        const hits = await suggestPlaces(form.destination).catch(() => []);
        place = hits[0] || null;
      }
      let originHit = originPlace;
      if ((!originHit?.lat || !originHit?.lon) && form.origin.trim()) {
        const originHits = await suggestPlaces(form.origin).catch(() => []);
        originHit = originHits[0] || null;
      }
      const destination = place?.label || form.destination.trim();
      const daysCount = Number(form.days) || 6;
      setPhase("Building your days…");
      const plan = await createPlan({
        ...form,
        origin: form.origin.trim(),
        originLat: originHit?.lat ?? null,
        originLon: originHit?.lon ?? null,
        originCountry: originHit?.country || "",
        destLat: place?.lat ?? null,
        destLon: place?.lon ?? null,
        destination,
        country: place?.country || "",
        travelers: travelerLine(form.adults, form.kids),
        startDate: form.startDate,
        endDate: tripEndIso(form.startDate, daysCount),
        days: daysCount,
        profile,
      });
      onSaved({
        id: uid(),
        createdAt: Date.now(),
        plan: {
          ...plan,
          destination: destination || plan?.destination,
          country: place?.country || plan?.country,
          startDate: form.startDate,
          endDate: tripEndIso(form.startDate, daysCount),
          daysCount,
          duration: formatTripSpan(form.startDate, daysCount) || plan?.duration || `${daysCount} days`,
          travelers: travelerLine(form.adults, form.kids),
          style: plan?.style || form.style,
        },
        picks: { stay: null, food: [], sights: [] },
        weather: null,
        travel: {
          origin: form.origin.trim(),
          adults: Number(form.adults) || 1,
          kids: Number(form.kids) || 0,
          modes: form.modes,
          stays: form.stays,
          style: form.style,
          originCountry: originHit?.country || "",
        },
      });
    } catch (err) {
      setError(err.message || "Safar could not build this plan.");
      setBusy(false);
      setPhase("");
    }
  };

  return (
    <section className="web-panel">
      <h1>Plan a trip</h1>
      <p>The same questions as the app. Safar writes the days and saves the trip on your account.</p>
      <form className="web-form web-plan" onSubmit={submit}>
        <PlaceField
          label="Leaving from"
          value={form.origin}
          placeholder={profile.homeCity || "Your city"}
          onChange={(origin) => {
            setOriginPlace(null);
            setForm((current) => ({ ...current, origin }));
          }}
          onSelect={setOriginPlace}
        />
        <PlaceField
          label="Destination"
          value={form.destination}
          placeholder="Start typing a city…"
          required
          onChange={(destination) => {
            setPickedPlace(null);
            setForm((current) => ({ ...current, destination }));
          }}
          onSelect={setPickedPlace}
        />
        <div className="web-split">
          <label className="web-field">
            <span>Start date</span>
            <input type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required />
          </label>
          <label className="web-field">
            <span>Days</span>
            <input type="number" min="2" max="30" value={form.days} onChange={(event) => setForm((current) => ({ ...current, days: event.target.value }))} />
          </label>
        </div>
        <p className="web-span">{formatTripSpan(form.startDate, form.days)}</p>
        <div className="web-split">
          <Stepper label="Adults" value={form.adults} min={1} max={12} onChange={(adults) => setForm((current) => ({ ...current, adults }))} />
          <Stepper label="Children" value={form.kids} min={0} max={8} onChange={(kids) => setForm((current) => ({ ...current, kids }))} />
        </div>
        <fieldset className="web-field">
          <span>How will you go?</span>
          <p className="web-span">Choose one or more. Safar uses these when it compares the way there.</p>
          <div className="web-choices">
            {TRANSPORT_MODES.map((mode) => {
              const on = form.modes.includes(mode.id);
              return (
                <button
                  key={mode.id}
                  type="button"
                  className={on ? "web-choice is-on" : "web-choice"}
                  aria-pressed={on}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      modes: on ? current.modes.filter((id) => id !== mode.id) : [...current.modes, mode.id],
                    }))
                  }
                >
                  <strong>{mode.label}</strong>
                  <span>{mode.line}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="web-field">
          <span>Where will you stay?</span>
          <p className="web-span">Choose one or more. Safar prices the days for this standard and does not name a hotel.</p>
          <div className="web-choices">
            {STAY_STANDARDS.map((item) => {
              const on = form.stays.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={on ? "web-choice is-on" : "web-choice"}
                  aria-pressed={on}
                  onClick={() => setForm((current) => ({ ...current, stays: toggleStay(current.stays, item.id) }))}
                >
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="web-field">
          <span>Budget ({profile.currency || "INR"})</span>
          <input
            value={form.budget}
            onChange={(event) => setForm((current) => ({ ...current, budget: event.target.value }))}
            placeholder={profile.currency === "INR" ? "Optional — e.g. 1.2 lakh" : "Optional — e.g. 2500"}
          />
        </label>
        <div className="web-field">
          <span>Style</span>
          <div className="web-styles">
            {TRIP_STYLES.map((name) => (
              <button
                key={name}
                type="button"
                className={form.style === name ? "web-ghost is-on" : "web-ghost"}
                onClick={() => setForm((current) => ({ ...current, style: name }))}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
        <label className="web-field">
          <span>Interests</span>
          <input
            value={form.interests}
            onChange={(event) => setForm((current) => ({ ...current, interests: event.target.value }))}
            placeholder="Food, temples, nightlife…"
          />
        </label>
        <label className="web-field">
          <span>Anything else</span>
          <textarea
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="First trip abroad, parents travelling, vegetarian food…"
          />
        </label>
        {error ? <p className="web-error">{error}</p> : null}
        <button type="submit" className="web-solid" disabled={busy || !form.destination.trim()}>
          {busy ? phase || "Planning…" : "Write my plan"}
        </button>
      </form>
    </section>
  );
}

function PlaceField({ label, value, placeholder, required = false, onChange, onSelect }) {
  const skip = useRef(false);
  const [hits, setHits] = useState([]);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      setHits([]);
      return undefined;
    }
    const q = String(value || "").trim();
    if (q.length < 2) {
      setHits([]);
      return undefined;
    }
    let cancel = false;
    const timer = setTimeout(() => {
      suggestPlaces(q)
        .then((places) => {
          if (!cancel) setHits(Array.isArray(places) ? places.slice(0, 5) : []);
        })
        .catch(() => {
          if (!cancel) setHits([]);
        });
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <label className="web-field">
      <span>{label}</span>
      <input
        value={value}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {hits.length ? (
        <div className="web-hits">
          {hits.map((place) => (
            <button
              key={place.id || place.label}
              type="button"
              onClick={() => {
                skip.current = true;
                onChange(place.label || place.name || "");
                onSelect?.(place);
                setHits([]);
              }}
            >
              {place.label || place.name}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="web-field">
      <span>{label}</span>
      <div className="web-step">
        <button type="button" onClick={() => onChange(Math.max(min, Number(value) - 1))} aria-label={`Fewer ${label}`}>
          −
        </button>
        <strong>{value}</strong>
        <button type="button" onClick={() => onChange(Math.min(max, Number(value) + 1))} aria-label={`More ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

function TripView({ trip, profile, onUpdate }) {
  const plan = trip?.plan;
  const travel = trip?.travel || {};
  const from = travel.origin || profile?.homeCity || "";
  const to = plan?.destination || "";
  const modes = Array.isArray(travel.modes) && travel.modes.length ? travel.modes : ["flight", "train", "bus"];
  const chosenStays = Array.isArray(travel.stays) ? travel.stays : [];
  const [flightPicks, setFlightPicks] = useState(Array.isArray(plan?.flightPicks) ? plan.flightPicks : null);
  const [pickNote, setPickNote] = useState("");

  useEffect(() => {
    setFlightPicks(Array.isArray(plan?.flightPicks) ? plan.flightPicks : null);
    setPickNote("");
  }, [trip?.id, plan?.flightPicks]);

  useEffect(() => {
    if (!plan || !from || !to || !modes.includes("flight") || Array.isArray(plan.flightPicks)) return undefined;
    let cancel = false;
    setPickNote("Choosing up to three flights…");
    suggestFlights({
      from,
      to,
      date: plan.startDate || "",
      adults: Number(travel.adults) || 1,
      kids: Number(travel.kids) || 0,
      currency: profile?.currency || plan.currency || "INR",
      profile,
    })
      .then((next) => {
        if (cancel) return;
        const list = Array.isArray(next) ? next.slice(0, 3) : [];
        setFlightPicks(list);
        setPickNote(list.length ? "" : "No flight stood out for this date. The train and bus searches are still below.");
        onUpdate?.({ ...trip, plan: { ...plan, flightPicks: list } });
      })
      .catch((err) => {
        if (!cancel) setPickNote(err.message || "Could not choose flights for this date.");
      });
    return () => {
      cancel = true;
    };
  }, [trip?.id, from, to, modes.join("|"), plan?.flightPicks]);

  if (!plan) return <section className="web-panel"><p className="web-empty">Choose a trip.</p></section>;

  const board = from && to
    ? buildJourney({
        from,
        to,
        date: plan.startDate || "",
        adults: Number(travel.adults) || 1,
        kids: Number(travel.kids) || 0,
        modes,
        rides: plan.rides,
        flightPicks: Array.isArray(plan.flightPicks) ? plan.flightPicks : flightPicks,
        originCountry: travel.originCountry || "",
        destCountry: plan.country || "",
        currency: profile?.currency || plan.currency,
        profile,
      })
    : null;
  const stays = STAY_STANDARDS.filter((item) => chosenStays.includes(item.id));
  const setStays = (id) => {
    onUpdate?.({ ...trip, travel: { ...travel, stays: toggleStay(chosenStays, id) } });
  };
  const expenses = Object.entries(plan.budget || {}).filter(([key, value]) => key !== "total" && value);
  const days = Array.isArray(plan.days) ? plan.days : [];

  return (
    <section className="web-panel web-trip">
      <p className="web-kicker">{plan.duration || ""}</p>
      <h1>{plan.destination || plan.title}</h1>
      {plan.summary ? <p className="web-summary">{plan.summary}</p> : null}
      {plan.budget?.total ? <p className="web-note">About {plan.budget.total}. These are estimates.</p> : null}

      <div className="web-block">
        <h2>Getting there</h2>
        {board ? (
          <>
            <p className="web-span">{[board.when, board.party, "one way"].filter(Boolean).join(" · ")}</p>
            <p className="web-summary">{board.headline}</p>
            {pickNote ? <p className="web-note">{pickNote}</p> : null}
            <div className="web-fare-grid">
              {board.options.map((option) => (
                <FareCard
                  key={option.id}
                  option={option}
                  fallbackHref={
                    option.id === "flight" && !option.picks?.length
                      ? `https://www.google.com/travel/flights/search?q=${encodeURIComponent(`One way flights from ${board.from} to ${board.to}`)}`
                      : ""
                  }
                />
              ))}
            </div>
            <p className="web-fine">{board.footnote}</p>
          </>
        ) : (
          <p className="web-span">Plan again with a departure city to compare flights, trains, and buses.</p>
        )}
      </div>

      <div className="web-block">
        <h2>Stay</h2>
        <p className="web-span">Choose one or more. Each opens a live search for that standard. Safar does not name a hotel for you.</p>
        <div className="web-stay-picks">
          {STAY_STANDARDS.map((item) => {
            const on = chosenStays.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={on ? "web-choice is-on" : "web-choice"}
                aria-pressed={on}
                onClick={() => setStays(item.id)}
              >
                <span className="web-choice-top">
                  <strong>{item.label}</strong>
                  <i className={on ? "is-on" : ""} aria-hidden="true">{on ? "✓" : ""}</i>
                </span>
                <span>{item.hint}</span>
              </button>
            );
          })}
        </div>
        {stays.length ? (
          <div className="web-stay-links">
            {stays.map((item) => {
              const href = staySearchUrl({
                id: item.id,
                destination: to,
                startDate: plan.startDate,
                endDate: plan.endDate,
                adults: Number(travel.adults) || 1,
              });
              if (!href) return null;
              return (
                <a key={item.id} className="web-stay-link" href={href} target="_blank" rel="noreferrer">
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.search} in {to}</small>
                  </span>
                  <em>See stays</em>
                </a>
              );
            })}
          </div>
        ) : null}
      </div>

      {expenses.length ? (
        <div className="web-block">
          <h2>Expenses</h2>
          <div className="web-expenses">
            {expenses.map(([key, value]) => (
              <p key={key}>
                <span>{budgetLabel(key)}</span>
                <strong>{value}</strong>
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="web-block">
        <h2>Days</h2>
        <ol>
          {days.map((day, index) => (
            <li key={day.day || index}>
              <span>Day {day.day || index + 1}</span>
              <div>
                <h3>{day.title}</h3>
                {day.morning ? <p><em>Morning</em>{day.morning}</p> : null}
                {day.afternoon ? <p><em>Afternoon</em>{day.afternoon}</p> : null}
                {day.evening ? <p><em>Evening</em>{day.evening}</p> : null}
                {day.cost ? <p className="web-note">{day.cost}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FareCard({ option, fallbackHref = "" }) {
  const primary = option.partners?.find((item) => item.primary) || option.partners?.[0];
  const rest = (option.partners || []).filter((item) => item !== primary);
  return (
    <article className={option.recommended ? "web-fare is-best" : "web-fare"}>
      <div className="web-fare-top">
        <div>
          {option.recommended ? <p className="web-kicker">Lower fare</p> : null}
          <h3>{option.label}</h3>
          {(option.service || option.duration) ? <p>{[option.service, option.duration].filter(Boolean).join(" · ")}</p> : null}
        </div>
        {option.price ? <strong>{option.price}</strong> : null}
      </div>
      {option.why ? <p>{option.why}</p> : null}
      {option.routeNote ? <p>{option.routeNote}</p> : null}
      {option.id === "flight" && option.picks?.length ? (
        <div className="web-flights">
          {option.picks.map((pick) => (
            <a key={`${pick.airline}-${pick.via}-${pick.fareLow}`} href={pick.href} target="_blank" rel="noreferrer">
              <span>
                {pick.best ? <em>Best fare</em> : null}
                <strong>{pick.airline}</strong>
                <small>{[pick.stopsLabel, pick.via ? `via ${pick.via}` : "", pick.duration].filter(Boolean).join(" · ")}</small>
              </span>
              <b>{pick.typicalFare || "See flight"}</b>
            </a>
          ))}
        </div>
      ) : null}
      {option.hint && option.id !== "flight" ? <p className="web-fine">{option.hint}</p> : null}
      {primary?.href ? (
        <a className="web-book" href={primary.href} target="_blank" rel="noreferrer">
          {primary.action || `See ${option.label.toLowerCase()}`}
        </a>
      ) : fallbackHref ? (
        <a className="web-book" href={fallbackHref} target="_blank" rel="noreferrer">
          See flights
        </a>
      ) : null}
      {rest.length ? (
        <div className="web-pills">
          {rest.map((item) => (
            <a key={item.id || item.name} href={item.href} target="_blank" rel="noreferrer">
              {item.name}
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function People() {
  const [users, setUsers] = useState([]);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("latest");
  const [selected, setSelected] = useState("");

  useEffect(() => {
    let cancel = false;
    Promise.all([fetchAdminUsers(), fetchAdminOverview()])
      .then(([people, pulse]) => {
        if (cancel) return;
        setUsers(people.users || []);
        setOverview(pulse);
      })
      .catch((err) => {
        if (!cancel) setError(err.message || "Could not load people.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  if (selected) return <Person id={selected} onBack={() => setSelected("")} />;

  const shown = users.filter((user) => filter === "all" || user.joinedVia === filter);
  const webCount = users.filter((user) => user.joinedVia === "web").length;
  const appCount = users.length - webCount;
  const asked = users.filter((user) => user.chatCount > 0).length;
  const planned = users.filter((user) => user.tripCount > 0).length;
  const quiet = users.filter((user) => !user.chatCount && !user.tripCount).length;
  const totals = Object.fromEntries((overview?.cards || []).map((card) => [card.key, card.value]));
  const places = (overview?.destinations || []).slice(0, 4);
  const recent = (overview?.recent || []).slice(0, 24);

  return (
    <section className="web-panel web-people">
      <h1>People</h1>
      <p>Every question Safar was asked, the reply that went back, and the trips people planned.</p>
      <div className="web-filters">
        <button type="button" className={view === "latest" ? "is-on" : ""} onClick={() => setView("latest")}>
          Latest
        </button>
        <button type="button" className={view === "users" ? "is-on" : ""} onClick={() => setView("users")}>
          Users
        </button>
      </div>
      {view === "latest" ? (
        <>
      <div className="web-analysis">
        <p>{users.length} people signed in. {asked} have a saved question, {planned} have a saved trip, and {quiet} have not asked or saved anything yet.</p>
        <p>{totals.asks || 0} questions reached Safar, {totals.asksWeek || 0} of them in the last 7 days. {totals.plans || 0} plans were written, including ones they did not save.</p>
        <p>{places.length ? `Most planned places: ${places.map((place) => `${place.name} (${place.count})`).join(", ")}.` : "No destination has been planned often enough to stand out yet."}</p>
      </div>
      <div className="web-stats">
        {(overview?.cards || []).map((card) => (
          <article key={card.key}>
            <strong>{card.value}</strong>
            <span>{card.label}</span>
          </article>
        ))}
      </div>
      <div className="web-feed">
        {recent.map((row, index) => (
          <FeedRow key={row.id || `${row.at}-${index}`} row={row} />
        ))}
        {recent.length === 0 && !error ? <p className="web-empty">No questions logged yet.</p> : null}
      </div>
        </>
      ) : (
        <>
      <div className="web-filters">
        <button type="button" className={filter === "all" ? "is-on" : ""} onClick={() => setFilter("all")}>
          All {users.length}
        </button>
        <button type="button" className={filter === "app" ? "is-on" : ""} onClick={() => setFilter("app")}>
          App {appCount}
        </button>
        <button type="button" className={filter === "web" ? "is-on" : ""} onClick={() => setFilter("web")}>
          Web {webCount}
        </button>
      </div>
      <div className="web-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Last question</th>
              <th>Questions</th>
              <th>Trips</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((user) => (
              <tr key={user.id} onClick={() => setSelected(user.id)}>
                <td>
                  <strong>{user.name || "No name yet"}</strong>
                  <small>{user.email}</small>
                </td>
                <td>{user.lastAsk || "—"}</td>
                <td>{user.chatCount || 0}</td>
                <td>{user.tripCount || 0}</td>
                <td>{user.joinedVia === "web" ? "Web" : "App"} · {when(user.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && !error ? <p className="web-empty">No one in this list yet.</p> : null}
        </>
      )}
      {error ? <p className="web-error">{error}</p> : null}
    </section>
  );
}

function FeedRow({ row }) {
  const [open, setOpen] = useState(false);
  const reply = row.reply || row.plan?.summary || row.error || "";
  return (
    <article>
      <button type="button" onClick={() => setOpen((value) => !value)}>
        <span>{row.action || row.kind || "Ask"} · {row.name || row.email || "Someone"}</span>
        <strong>{row.query || row.destination || row.resultTitle || "No text stored"}</strong>
        <em>{whenTime(row.at)}</em>
      </button>
      {open ? (
        <div>
          {reply ? <RichText text={reply} /> : <p className="web-note">Safar’s reply was not stored for this older row.</p>}
        </div>
      ) : null}
    </article>
  );
}

function Person({ id, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("chats");

  useEffect(() => {
    let cancel = false;
    fetchAdminUser(id)
      .then((next) => {
        if (!cancel) setData(next);
      })
      .catch((err) => {
        if (!cancel) setError(err.message || "Could not open this person.");
      });
    return () => {
      cancel = true;
    };
  }, [id]);

  const user = data?.user;
  const chats = user?.chats || [];
  const trips = user?.trips || [];
  const activity = data?.activity || [];
  const searches = data?.searches || [];
  const asks = activity.filter((row) => row.action === "ask");

  return (
    <section className="web-panel web-people">
      <button type="button" className="web-quiet" onClick={onBack}>
        All people
      </button>
      {!user && !error ? <p className="web-note">Opening their questions…</p> : null}
      {error ? <p className="web-error">{error}</p> : null}
      {user ? (
        <>
          <h1>{user.name || "No name yet"}</h1>
          <p>{user.email} · {user.homeCity || "No home city"} · joined on the {user.joinedVia === "web" ? "web" : "app"} · {when(user.createdAt)}</p>
          <div className="web-filters">
            <button type="button" className={tab === "chats" ? "is-on" : ""} onClick={() => setTab("chats")}>Questions {chats.length}</button>
            <button type="button" className={tab === "asks" ? "is-on" : ""} onClick={() => setTab("asks")}>Replies {asks.length}</button>
            <button type="button" className={tab === "plans" ? "is-on" : ""} onClick={() => setTab("plans")}>Plans {searches.length}</button>
            <button type="button" className={tab === "trips" ? "is-on" : ""} onClick={() => setTab("trips")}>Saved trips {trips.length}</button>
          </div>
          {tab === "chats" ? (
            <div className="web-feed">
              {chats.length === 0 ? <p className="web-empty">No saved conversation.</p> : null}
              {chats.map((chat) => (
                <article key={chat.id}>
                  <p className="web-kicker">{whenTime(chat.updatedAt)}</p>
                  {(chat.messages || []).map((message, index) => (
                    <div key={`${chat.id}-${index}`} className={message.role === "user" ? "web-qa is-you" : "web-qa"}>
                      <span>{message.role === "user" ? "They asked" : "Safar replied"}</span>
                      {message.role === "user" ? <p>{message.content}</p> : <RichText text={message.content} />}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "asks" ? (
            <div className="web-feed">
              {asks.length === 0 ? <p className="web-empty">No logged reply for this email yet.</p> : null}
              {asks.map((row, index) => (
                <article key={row.id || index}>
                  <p className="web-kicker">{whenTime(row.at)}{row.ok === false ? " · failed" : ""}</p>
                  <div className="web-qa is-you">
                    <span>They asked</span>
                    <p>{row.query || "—"}</p>
                  </div>
                  <div className="web-qa">
                    <span>Safar replied</span>
                    {row.reply ? <RichText text={row.reply} /> : <p className="web-note">{row.error || "The reply was not stored."}</p>}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {tab === "plans" ? (
            <div className="web-feed">
              {searches.length === 0 ? <p className="web-empty">No plan search stored.</p> : null}
              {searches.map((row, index) => (
                <article key={row.id || index}>
                  <p className="web-kicker">{whenTime(row.at)} · {row.kind || "plan"}</p>
                  <h3>{row.resultTitle || row.destination || "Plan"}</h3>
                  <p className="web-span">{[row.destination, row.startDate, row.endDate, row.travelers, row.style, row.resultBudget].filter(Boolean).join(" · ")}</p>
                  {row.notes ? <p>{row.notes}</p> : null}
                  {row.resultPlan?.summary ? <p>{row.resultPlan.summary}</p> : null}
                  {Array.isArray(row.resultPlan?.days) ? (
                    <ol>
                      {row.resultPlan.days.map((day, dayIndex) => (
                        <li key={day.day || dayIndex}>{day.title || `Day ${day.day || dayIndex + 1}`}</li>
                      ))}
                    </ol>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
          {tab === "trips" ? (
            <div className="web-feed">
              {trips.length === 0 ? <p className="web-empty">No saved trip.</p> : null}
              {trips.map((trip) => (
                <article key={trip.id}>
                  <h3>{trip.plan?.title || trip.plan?.destination || "Trip"}</h3>
                  <p className="web-span">{[trip.plan?.duration, trip.plan?.travelers, whenTime(trip.createdAt)].filter(Boolean).join(" · ")}</p>
                  {trip.plan?.summary ? <p>{trip.plan.summary}</p> : null}
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function whenTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function placeName(trip) {
  const raw = trip.plan?.destination || trip.plan?.title || "Trip";
  return String(raw).split(",")[0].trim() || "Trip";
}

function preview(chat) {
  const message = [...(chat.messages || [])].reverse().find((item) => item.role === "user" && item.content);
  const text = String(message?.content || "Question").replace(/\s+/g, " ").trim();
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

function when(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector("script[data-safar-gis]");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Could not load Google Sign-In.")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.safarGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Sign-In."));
    document.head.appendChild(script);
  });
}
