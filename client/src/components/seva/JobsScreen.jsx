import { formatRupees, skillByKey } from "../../lib/seva/skills.js";
import { updateLocalJob } from "../../lib/seva/sync.js";
import { jobShareText, shareOrSms } from "../../lib/seva/share.js";
import { useSeva } from "./SevaProvider.jsx";

const STATUS = {
  open: { text: "खुला", cls: "bg-orange-100 text-orange-900" },
  claimed: { text: "ले लिया", cls: "bg-sky-100 text-sky-900" },
  done: { text: "हो गया", cls: "bg-emerald-100 text-emerald-900" },
};

export function JobsScreen() {
  const { session, jobs, workers, refreshLocal, sync } = useSeva();

  async function setStatus(job, status, workerClientId) {
    await updateLocalJob(job.clientId, { status, workerClientId: workerClientId || "" });
    await refreshLocal();
    void sync();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-sky-950">काम बोर्ड</h1>
      <p className="text-base text-stone-600">
        पड़ोसी की माँग। SMS से भी भेजें जब नेट न हो।
      </p>

      {jobs.length === 0 ? (
        <p className="rounded-2xl bg-stone-100 px-4 py-10 text-center text-lg text-stone-600">
          अभी कोई माँग नहीं।
        </p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => {
            const skill = skillByKey(j.skillKey);
            const st = STATUS[j.status] || STATUS.open;
            const claimedBy = workers.find((w) => w.clientId === j.workerClientId);
            return (
              <li key={j.clientId} className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-4xl">{skill.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black">{skill.label}</p>
                    <p className="text-base font-semibold text-stone-700">
                      {j.posterName}
                    </p>
                    {j.payPaise ? (
                      <p className="text-sm font-bold text-emerald-800">
                        {formatRupees(j.payPaise)}
                      </p>
                    ) : null}
                    {claimedBy ? (
                      <p className="text-sm text-sky-800">
                        {claimedBy.displayName} ले रहे हैं
                      </p>
                    ) : null}
                    {j.pendingSync ? (
                      <p className="text-xs text-stone-500">सिंक बाकी</p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold ${st.cls}`}
                  >
                    {st.text}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-xl bg-sky-800 px-3 text-sm font-bold text-white"
                    onClick={() =>
                      void shareOrSms(
                        "ग्रामसेवा",
                        jobShareText({
                          villageName: session.villageName,
                          posterName: j.posterName,
                          skillLabel: skill.label,
                          payRupees: j.payPaise ? j.payPaise / 100 : 0,
                          code: session.villageCode,
                        }),
                      )
                    }
                  >
                    SMS / शेयर
                  </button>
                  {j.status === "open" && workers.length > 0 ? (
                    <ClaimMenu
                      workers={workers.filter((w) => w.skillKey === j.skillKey)}
                      fallback={workers}
                      onPick={(id) => setStatus(j, "claimed", id)}
                    />
                  ) : null}
                  {j.status === "claimed" ? (
                    <button
                      type="button"
                      className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white"
                      onClick={() => setStatus(j, "done", j.workerClientId)}
                    >
                      हो गया
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ClaimMenu({ workers, fallback, onPick }) {
  const list = workers.length ? workers : fallback;
  if (list.length === 0) return null;
  return (
    <label className="min-h-11">
      <span className="sr-only">काम लें</span>
      <select
        defaultValue=""
        className="min-h-11 rounded-xl bg-orange-600 px-3 text-sm font-bold text-white"
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
          e.target.value = "";
        }}
      >
        <option value="">काम लें</option>
        {list.map((w) => (
          <option key={w.clientId} value={w.clientId}>
            {w.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
