import { useState } from "react";
import { InstallPrompt } from "../InstallPrompt.jsx";
import { LanguageToggle } from "./LanguageToggle.jsx";
import { useNews } from "./NewsProvider.jsx";

const OTHER_VILLAGE = "__other__";

export function NewsOnboarding() {
  const { setSession, t, te } = useNews();
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

  function applyVillageChoice(choice, custom = customVillage, list = villages) {
    if (choice === OTHER_VILLAGE) {
      const typed = custom.replace(/\s+/g, " ").trim();
      const hit = list.find(
        (v) => v.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-IN") === typed.toLocaleLowerCase("en-IN"),
      );
      if (hit) {
        setVillageChoice(hit);
        setVillageName(hit);
        setCustomVillage("");
        return;
      }
      setVillageChoice(OTHER_VILLAGE);
      setCustomVillage(custom);
      setVillageName(typed);
      return;
    }
    setVillageChoice(choice);
    setVillageName(choice);
  }

  async function loadVillages(pinValue, officeName) {
    const qs = new URLSearchParams({ pincode: pinValue });
    if (officeName) qs.set("postOffice", officeName);
    const res = await fetch(`/api/news/villages?${qs}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || t("villagesFailed"));
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
      if (!res.ok) throw new Error(data.error || t("pinNotFound"));
      setLookup(data);
      const firstOffice = data.postOffices?.[0]?.name || "";
      setPostOffice(firstOffice);
      await loadVillages(pinValue, firstOffice);
    } catch (err) {
      setLookup(null);
      setVillages([]);
      setVillageMeta(null);
      setError(te(err.message));
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
      setError(te(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function useGps() {
    setError("");
    if (!navigator.geolocation) {
      setError(t("noGps"));
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
          if (!res.ok) throw new Error(data.error || t("geoFailed"));
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          if (data.pincode) {
            setPincode(data.pincode);
            const pinRes = await fetch(`/api/news/pincode/${data.pincode}`);
            const pinData = await pinRes.json();
            if (!pinRes.ok) throw new Error(pinData.error || t("pinNotFound"));
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
          setError(te(err.message));
        } finally {
          setBusy(false);
        }
      },
      () => {
        setBusy(false);
        setError(t("gpsPermission"));
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
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || t("loginFailed"));
        setSession({ token: data.token, user: data.user });
        return;
      }

      const finalVillage =
        villageChoice === OTHER_VILLAGE ? customVillage.trim() : villageName.trim();
      if (!finalVillage) {
        throw new Error(t("pickVillage"));
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
      if (!res.ok) throw new Error(data.error || t("registerFailed"));
      setSession({ token: data.token, user: data.user });
    } catch (err) {
      setError(te(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="glass rise mb-6 rounded-[2rem] px-6 py-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--forest)] text-3xl text-white shadow-lg">
          🌾
        </div>
        <p className="kicker mt-4">VILLAGE</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-[var(--ink)]">{t("appName")}</h1>
        <p className="mt-2 text-base font-medium text-stone-500">{t("tagline")}</p>
      </div>

      <LanguageToggle />

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-black/5 p-1">
        <button
          type="button"
          className={`min-h-12 rounded-full text-base font-bold ${
            mode === "register" ? "bg-white text-[var(--forest-deep)] shadow-sm" : "text-stone-500"
          }`}
          onClick={() => setMode("register")}
        >
          {t("createAccount")}
        </button>
        <button
          type="button"
          className={`min-h-12 rounded-full text-base font-bold ${
            mode === "login" ? "bg-white text-[var(--forest-deep)] shadow-sm" : "text-stone-500"
          }`}
          onClick={() => setMode("login")}
        >
          {t("login")}
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "register" ? (
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("yourName")}
            className="input-field"
          />
        ) : null}

        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("email")}
          className="input-field"
        />
        <input
          required
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "login" ? t("password") : t("passwordHint")}
          className="input-field"
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
                placeholder={t("pincode")}
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={() => pincode.length === 6 && fetchPin(pincode)}
                className="btn-primary min-h-14 rounded-2xl px-4 font-bold"
              >
                {t("search")}
              </button>
            </div>

            <button
              type="button"
              onClick={() => void useGps()}
              className="min-h-12 w-full rounded-2xl bg-white font-bold text-[var(--forest-deep)] shadow-sm"
            >
              {t("gps")}
            </button>

            {lookup ? (
              <div className="card rounded-2xl p-3 text-sm font-semibold text-[var(--forest-deep)]">
                <p>{lookup.state}</p>
                <p>{lookup.district}</p>
                {villageMeta?.block ? (
                  <p>
                    {t("block")}: {villageMeta.block}
                  </p>
                ) : null}
              </div>
            ) : null}

            {lookup?.postOffices?.length ? (
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-stone-600">
                  {t("postOffice")}
                </span>
                <select
                  value={postOffice}
                  onChange={(e) => void onPostOfficeChange(e.target.value)}
                  className="input-field"
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
                  {t("villageName")}
                </span>
                <select
                  required={villageChoice !== OTHER_VILLAGE}
                  value={villageChoice}
                  onChange={(e) => applyVillageChoice(e.target.value)}
                  className="input-field"
                >
                  {villages.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  <option value={OTHER_VILLAGE}>{t("otherVillage")}</option>
                </select>
                {villageChoice === OTHER_VILLAGE ? (
                  <input
                    required
                    value={customVillage}
                    onChange={(e) => applyVillageChoice(OTHER_VILLAGE, e.target.value)}
                    placeholder={t("villageExample")}
                    className="input-field mt-2"
                  />
                ) : null}
              </label>
            ) : (
              <input
                required
                value={villageName}
                onChange={(e) => setVillageName(e.target.value)}
                placeholder={t("searchPinFirst")}
                className="input-field"
              />
            )}
          </>
        ) : (
          <p className="text-center text-sm font-semibold text-stone-500">{t("loginHint")}</p>
        )}

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center font-semibold text-red-800">
            {error}
          </p>
        ) : null}

        <button
          disabled={busy}
          className="btn-primary min-h-16 w-full rounded-2xl text-xl font-extrabold disabled:opacity-50"
        >
          {busy ? t("wait") : mode === "register" ? t("createAccount") : t("login")}
        </button>
      </form>

      <div className="mt-8">
        <InstallPrompt />
      </div>
    </div>
  );
}
