import { Link } from "react-router-dom";
import { useSeva } from "./SevaProvider.jsx";
import { SevaSyncBadge } from "./SevaOfflineBanner.jsx";
import { InstallPrompt } from "../InstallPrompt.jsx";
import { jobShareText, shareOrSms } from "../../lib/seva/share.js";
import { skillByKey } from "../../lib/seva/skills.js";

export function SevaHome() {
  const { session, workers, jobs, pending, logout, sync } = useSeva();
  const openJobs = jobs.filter((j) => j.status === "open");

  async function shareVillage() {
    const latest = openJobs[0];
    const text = latest
      ? jobShareText({
          villageName: session.villageName,
          posterName: latest.posterName,
          skillLabel: skillByKey(latest.skillKey).label,
          payRupees: latest.payPaise ? latest.payPaise / 100 : 0,
          code: session.villageCode,
        })
      : `ग्रामसेवा: ${session.villageName} से जुड़ें। गाँव कोड ${session.villageCode}`;
    await shareOrSms("ग्रामसेवा", text);
  }

  return (
    <div className="space-y-4 pb-4">
      <InstallPrompt />
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link to="/" className="text-sm font-semibold text-sky-800">
            ← Village
          </Link>
          <h1 className="mt-1 text-3xl font-black text-sky-950">ग्रामसेवा</h1>
          <p className="text-lg font-bold text-stone-700">{session?.villageName}</p>
          <p className="mt-1 font-mono text-lg tracking-widest text-stone-500">
            कोड {session?.villageCode}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SevaSyncBadge />
          <button
            type="button"
            onClick={logout}
            className="text-sm font-semibold text-stone-500"
          >
            बाहर
          </button>
        </div>
      </header>

      <section className="rounded-3xl bg-sky-800 p-5 text-white shadow-lg">
        <p className="text-sm font-semibold text-sky-100">खुले काम</p>
        <p className="mt-1 text-4xl font-black">{openJobs.length}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-sky-100">कारीगर</p>
            <p className="text-xl font-bold">{workers.length}</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-sky-100">सिंक बाकी</p>
            <p className="text-xl font-bold">{pending}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <HomeTile href="/seva/directory" color="bg-sky-700" emoji="👷" label="लोग" />
        <HomeTile href="/seva/post" color="bg-orange-600" emoji="📢" label="काम माँगें" />
        <HomeTile href="/seva/jobs" color="bg-stone-700" emoji="📋" label="बोर्ड" />
        <button
          type="button"
          onClick={() => void shareVillage()}
          className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl bg-emerald-700 text-white shadow-md"
        >
          <span className="text-4xl">📤</span>
          <span className="text-xl font-black">SMS / शेयर</span>
        </button>
      </section>

      <button
        type="button"
        onClick={() => void sync()}
        className="min-h-12 w-full rounded-2xl bg-white text-base font-bold text-sky-900 shadow-sm"
      >
        अभी सिंक करें
      </button>
    </div>
  );
}

function HomeTile({ href, color, emoji, label }) {
  return (
    <Link
      to={href}
      className={`${color} flex min-h-32 flex-col items-center justify-center gap-2 rounded-3xl text-white shadow-md`}
    >
      <span className="text-4xl">{emoji}</span>
      <span className="text-xl font-black">{label}</span>
    </Link>
  );
}
