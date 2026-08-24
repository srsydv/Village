import { Link } from "react-router-dom";
import { InstallPrompt } from "./InstallPrompt.jsx";

export function VillageHub() {
  return (
    <div className="min-h-dvh bg-[#f6f1e7]">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
        <header className="mb-10 text-center">
          <p className="text-sm font-semibold tracking-[0.25em] text-stone-500">
            VILLAGE
          </p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-emerald-950">
            Village
          </h1>
          <p className="mt-3 text-lg text-stone-600">
            गाँव का खाता और पड़ोसी की सेवा — एक जगह
          </p>
        </header>

        <div className="grid gap-4">
          <Link
            to="/samooh"
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl bg-emerald-800 text-white shadow-lg"
          >
            <span className="text-5xl" aria-hidden>
              🤝
            </span>
            <span className="text-3xl font-black">समूह</span>
            <span className="px-6 text-center text-base text-emerald-100">
              बचत समूह का डिजिटल खाता
            </span>
          </Link>
          <Link
            to="/seva"
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl bg-sky-800 text-white shadow-lg"
          >
            <span className="text-5xl" aria-hidden>
              🛠️
            </span>
            <span className="text-3xl font-black">ग्रामसेवा</span>
            <span className="px-6 text-center text-base text-sky-100">
              मिस्त्री, बिजली, मजदूर और काम बोर्ड
            </span>
          </Link>
        </div>

        <div className="mt-8">
          <InstallPrompt />
        </div>
      </div>
    </div>
  );
}
