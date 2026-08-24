import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AmountKeypad } from "../AmountKeypad.jsx";
import { SkillPicker } from "./DirectoryScreen.jsx";
import { useSeva } from "./SevaProvider.jsx";
import { queueJob } from "../../lib/seva/sync.js";
import { jobShareText, shareOrSms } from "../../lib/seva/share.js";
import { rupeesToPaise, skillByKey } from "../../lib/seva/skills.js";
import { sevaJobPhrase, speakHindi } from "../../lib/tts.js";

export function PostJobScreen() {
  const { session, refreshLocal, sync } = useSeva();
  const navigate = useNavigate();
  const [skillKey, setSkillKey] = useState("mechanic");
  const [posterName, setPosterName] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  async function save(alsoShare) {
    if (!session) return;
    if (!posterName.trim()) {
      setStatus("अपना नाम डालें");
      return;
    }
    const rupees = amount ? Number(amount) : 0;
    const row = await queueJob({
      villageId: session.villageId,
      skillKey,
      posterName: posterName.trim(),
      payPaise: rupees > 0 ? rupeesToPaise(rupees) : 0,
    });
    await refreshLocal();
    const skill = skillByKey(skillKey);
    speakHindi(
      sevaJobPhrase({ posterName: row.posterName, skillLabel: skill.label }),
    );
    setStatus("माँग सेव हो गई");
    void sync();
    if (alsoShare) {
      await shareOrSms(
        "ग्रामसेवा",
        jobShareText({
          villageName: session.villageName,
          posterName: row.posterName,
          skillLabel: skill.label,
          payRupees: rupees || 0,
          code: session.villageCode,
        }),
      );
    }
    navigate("/seva/jobs");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-sky-950">काम माँगें</h1>
      <p className="text-base text-stone-600">
        आइकन चुनें। नेट न हो तो SMS से पड़ोसी को भेजें।
      </p>

      <SkillPicker value={skillKey} onChange={setSkillKey} />

      <input
        value={posterName}
        onChange={(e) => setPosterName(e.target.value)}
        placeholder="आपका नाम"
        className="min-h-14 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 text-lg"
      />

      <div className="rounded-3xl bg-white p-4 text-center shadow-sm">
        <p className="text-sm font-semibold text-stone-500">मज़दूरी (₹) — वैकल्पिक</p>
        <p className="text-5xl font-black text-sky-950">{amount || "0"}</p>
      </div>
      <AmountKeypad value={amount} onChange={setAmount} />

      {status ? (
        <p className="text-center font-semibold text-sky-800">{status}</p>
      ) : null}

      <button
        type="button"
        onClick={() => void save(false)}
        className="min-h-16 w-full rounded-2xl bg-sky-800 text-xl font-black text-white"
      >
        सहेजें और सुनें
      </button>
      <button
        type="button"
        onClick={() => void save(true)}
        className="min-h-16 w-full rounded-2xl bg-orange-600 text-xl font-black text-white"
      >
        सहेजें + SMS / शेयर
      </button>
    </div>
  );
}
