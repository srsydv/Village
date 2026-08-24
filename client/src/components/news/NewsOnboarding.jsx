import { useState } from "react";
import { InstallPrompt } from "../InstallPrompt.jsx";
import { useNews } from "./NewsProvider.jsx";

const OTHER_VILLAGE = "__other__";

export function NewsOnboarding() {
  const { setSession } = useNews();
  const [mode, setMode] = useState("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pincode, setPincode] = useState("");
  const [villageName, setVillageName] = useState("");
  const [villageChoice, setVillageChoice] = useState("");
  const [customVillage, setCustomVillage] = useState("");
  const [postOffice, setPostOffice] = useState("");
  const [lookup, setLookup] = useState(null);
  const [villages, setVillages] = useState([]);
  const [villageMeta, setVillageMeta] = useState(null);
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function applyVillageChoice(choice, custom = customVillage) {
    setVillageChoice(choice);
    if (choice === OTHER_VILLAGE) {
      setVillageName(custom.trim());
    } else {
      setVillageName(choice);
    }
  }

  async function loadVillages(pinValue, officeName) {
    const qs = new URLSearchParams({ pincode: pinValue });
    if (officeName) qs.set("postOffice", officeName);
    const res = await fetch(`/api/news/villages?${qs}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "गाँव सूची नहीं मिली");
    const list = data.villages || [];
    setVillages(list);
    setVillageMeta({ block: data.block || "", source: data.source || "" });
    if (list.length) {
      applyVillageChoice(list[0], "");
      setCustomVillage("");
    } else {
      applyVillageChoice(OTHER_VILLAGE, "");
    }
    return data;
  }

  async function fetchPin(pinValue) {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/news/pincode/${pinValue}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "पिन कोड नहीं मिला");
      setLookup(data);
      const firstOffice = data.postOffices?.[0]?.name || "";
      setPostOffice(firstOffice);
      await loadVillages(pinValue, firstOffice);
    } catch (err) {
      setLookup(null);
      setVillages([]);
      setVillageMeta(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPostOfficeChange(name) {
    setPostOffice(name);
    if (pincode.length !== 6) return;
    setBusy(true);
    setError("");
    try {
      await loadVillages(pincode, name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function useGps() {
    setError("");
    if (!navigator.geolocation) {
      setError("इस फोन पर GPS नहीं है");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/news/geo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "स्थान नहीं मिला");
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          if (data.pincode) {
            setPincode(data.pincode);
            const pinRes = await fetch(`/api/news/pincode/${data.pincode}`);
            const pinData = await pinRes.json();
            if (!pinRes.ok) throw new Error(pinData.error || "पिन कोड नहीं मिला");
            setLookup(pinData);
            const firstOffice = pinData.postOffices?.[0]?.name || "";
            setPostOffice(firstOffice);
            const villageData = await loadVillages(data.pincode, firstOffice);
            const list = villageData.villages || [];
            if (data.villageGuess) {
              const guess = data.villageGuess;
              if (list.some((v) => v.toLocaleLowerCase("en-IN") === guess.toLocaleLowerCase("en-IN"))) {
                applyVillageChoice(guess);
              } else {
                setCustomVillage(guess);
                applyVillageChoice(OTHER_VILLAGE, guess);
              }
            }
          } else if (data.villageGuess) {
            setCustomVillage(data.villageGuess);
            applyVillageChoice(OTHER_VILLAGE, data.villageGuess);
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setError("स्थान की अनुमति दें");
      },
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const res = await fetch("/api/news/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "लॉगिन नहीं हुआ");
        setSession({ token: data.token, user: data.user });
        return;
      }

      const finalVillage =
        villageChoice === OTHER_VILLAGE ? customVillage.trim() : villageName.trim();
      if (!finalVillage) {
        throw new Error("गाँव चुनें या लिखें");
      }
      const res = await fetch("/api/news/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password,
          pincode,
          villageName: finalVillage,
          postOffice,
          lat,
          lng,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "खाता नहीं बना");
      setSession({ token: data.token, user: data.user });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <p className="text-5xl" aria-hidden>
          🗞️
        </p>
        <h1 className="mt-3 text-4xl font-black text-teal-950">समाचार</h1>
        <p className="mt-2 text-lg text-stone-600">
          खाता बनाएं, फिर ईमेल और पासवर्ड से अंदर आएं
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1">
        <button
          type="button"
          className={`min-h-12 rounded-xl text-base font-bold ${
            mode === "register" ? "bg-white text-teal-900 shadow" : "text-stone-500"
          }`}
          onClick={() => setMode("register")}
        >
          खाता बनाएं
        </button>
        <button
          type="button"
          className={`min-h-12 rounded-xl text-base font-bold ${
            mode === "login" ? "bg-white text-teal-900 shadow" : "text-stone-500"
          }`}
          onClick={() => setMode("login")}
        >
          लॉगिन
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" ? (
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="आपका नाम"
            className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
          />
        ) : null}

        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ईमेल"
          className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
        />
        <input
          required
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "login" ? "पासवर्ड" : "पासवर्ड (कम से कम 6 अक्षर)"}
          className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
        />

        {mode === "register" ? (
          <>
            <div className="flex gap-2">
              <input
                required
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="पिन कोड 276404"
                className="min-h-14 flex-1 rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
              />
              <button
                type="button"
                onClick={() => pincode.length === 6 && fetchPin(pincode)}
                className="min-h-14 rounded-2xl bg-teal-800 px-4 font-bold text-white"
              >
                खोजें
              </button>
            </div>

            <button
              type="button"
              onClick={() => void useGps()}
              className="min-h-12 w-full rounded-2xl bg-white font-bold text-teal-900 shadow-sm"
            >
              📍 GPS से पता लगाएं
            </button>

            {lookup ? (
              <div className="rounded-2xl bg-teal-50 p-3 text-sm font-semibold text-teal-950">
                <p>{lookup.state}</p>
                <p>{lookup.district}</p>
                {villageMeta?.block ? <p>ब्लॉक: {villageMeta.block}</p> : null}
              </div>
            ) : null}

            {lookup?.postOffices?.length ? (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-stone-600">
                  डाकघर / इलाका (India Post)
                </span>
                <select
                  value={postOffice}
                  onChange={(e) => void onPostOfficeChange(e.target.value)}
                  className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-3 text-lg"
                >
                  {lookup.postOffices.map((po) => (
                    <option key={po.name} value={po.name}>
                      {po.name}
                      {po.block ? ` — ${po.block}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {lookup ? (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-stone-600">
                  गाँव का नाम
                </span>
                <select
                  required={villageChoice !== OTHER_VILLAGE}
                  value={villageChoice}
                  onChange={(e) => applyVillageChoice(e.target.value)}
                  className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-3 text-lg"
                >
                  {villages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  <option value={OTHER_VILLAGE}>अन्य गाँव — खुद लिखें</option>
                </select>
                {villageChoice === OTHER_VILLAGE ? (
                  <input
                    required
                    value={customVillage}
                    onChange={(e) => {
                      setCustomVillage(e.target.value);
                      setVillageName(e.target.value.trim());
                    }}
                    placeholder="जैसे नूरपुर सरैहजी"
                    className="mt-2 min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
                  />
                ) : null}
              </label>
            ) : (
              <input
                required
                value={villageName}
                onChange={(e) => setVillageName(e.target.value)}
                placeholder="पहले पिन कोड खोजें — फिर गाँव चुनें"
                className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
              />
            )}
          </>
        ) : (
          <p className="text-center text-sm font-semibold text-stone-500">
            खाता बना चुके हैं? सिर्फ ईमेल और पासवर्ड से अंदर आएं।
          </p>
        )}

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center font-semibold text-red-800">
            {error}
          </p>
        ) : null}

        <button
          disabled={busy}
          className="min-h-16 w-full rounded-2xl bg-teal-800 text-xl font-black text-white disabled:opacity-50"
        >
          {busy ? "रुकिए…" : mode === "register" ? "खाता बनाएं" : "लॉगिन"}
        </button>
      </form>

      <div className="mt-8">
        <InstallPrompt />
      </div>
    </div>
  );
}
