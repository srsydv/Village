import { useState } from "react";
import { SKILLS, skillByKey } from "../../lib/seva/skills.js";
import { queueWorker } from "../../lib/seva/sync.js";
import { shareOrSms, telHref, workerShareText } from "../../lib/seva/share.js";
import { speakHindi, sevaWorkerPhrase } from "../../lib/tts.js";
import { useSeva } from "./SevaProvider.jsx";

export function DirectoryScreen() {
  const { session, workers, refreshLocal, sync } = useSeva();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [skillKey, setSkillKey] = useState("mechanic");
  const [filter, setFilter] = useState("all");

  const shown =
    filter === "all" ? workers : workers.filter((w) => w.skillKey === filter);

  async function addWorker(e) {
    e.preventDefault();
    if (!session || !displayName.trim()) return;
    const row = await queueWorker({
      villageId: session.villageId,
      displayName: displayName.trim(),
      skillKey,
      phone: phone.replace(/\D/g, "").slice(0, 10),
    });
    await refreshLocal();
    speakHindi(
      sevaWorkerPhrase({
        displayName: row.displayName,
        skillLabel: skillByKey(row.skillKey).label,
      }),
    );
    setDisplayName("");
    setPhone("");
    setOpen(false);
    void sync();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-sky-950">कारीगर</h1>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-12 rounded-2xl bg-sky-800 px-4 font-bold text-white"
        >
          {open ? "बंद" : "+ जोड़ें"}
        </button>
      </header>

      {open ? (
        <form
          onSubmit={addWorker}
          className="space-y-3 rounded-3xl bg-white p-4 shadow-sm"
        >
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="नाम"
            className="min-h-14 w-full rounded-2xl border-2 border-stone-200 px-4 text-lg"
          />
          <input
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
            }
            inputMode="numeric"
            placeholder="फोन (वैकल्पिक)"
            className="min-h-14 w-full rounded-2xl border-2 border-stone-200 px-4 text-lg"
          />
          <SkillPicker value={skillKey} onChange={setSkillKey} />
          <button className="min-h-14 w-full rounded-2xl bg-sky-800 text-lg font-black text-white">
            सहेजें और सुनें
          </button>
        </form>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="सब"
        />
        {SKILLS.map((s) => (
          <FilterChip
            key={s.key}
            active={filter === s.key}
            onClick={() => setFilter(s.key)}
            label={`${s.emoji} ${s.label}`}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl bg-stone-100 px-4 py-10 text-center text-lg text-stone-600">
          अभी कोई कारीगर नहीं। जोड़ें या SMS से बताएं।
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((w) => {
            const skill = skillByKey(w.skillKey);
            const call = telHref(w.phone);
            return (
              <li
                key={w.clientId}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm"
              >
                <span className="text-4xl">{skill.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{w.displayName}</p>
                  <p className="text-sm font-semibold text-sky-800">{skill.label}</p>
                  {w.pendingSync ? (
                    <p className="text-xs text-stone-500">सिंक बाकी</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {call ? (
                    <a
                      href={call}
                      className="min-h-11 rounded-xl bg-emerald-700 px-3 text-center text-sm font-bold leading-[2.75rem] text-white"
                    >
                      कॉल
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="min-h-11 rounded-xl bg-sky-800 px-3 text-sm font-bold text-white"
                    onClick={() =>
                      void shareOrSms(
                        "ग्रामसेवा",
                        workerShareText({
                          villageName: session.villageName,
                          displayName: w.displayName,
                          skillLabel: skill.label,
                          phone: w.phone,
                          code: session.villageCode,
                        }),
                        w.phone,
                      )
                    }
                  >
                    SMS
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function SkillPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {SKILLS.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          className={`flex min-h-16 flex-col items-center justify-center rounded-2xl text-xl ${
            value === s.key
              ? "bg-sky-100 ring-4 ring-sky-700"
              : "bg-stone-50"
          }`}
          aria-label={s.label}
        >
          <span>{s.emoji}</span>
          <span className="mt-1 text-[11px] font-bold leading-tight">{s.label}</span>
        </button>
      ))}
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-2xl px-3 py-2 text-sm font-bold ${
        active ? "bg-sky-800 text-white" : "bg-white text-stone-600"
      }`}
    >
      {label}
    </button>
  );
}
