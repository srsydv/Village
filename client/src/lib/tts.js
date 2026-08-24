export function speakHindi(text) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const speak = () => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "hi-IN";
    utter.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const hindi = voices.find(
      (v) => v.lang.startsWith("hi") || v.name.toLowerCase().includes("hindi"),
    );
    if (hindi) utter.voice = hindi;
    window.speechSynthesis.speak(utter);
  };

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", speak, {
      once: true,
    });
    speak();
    return;
  }
  speak();
}

export function sevaJobPhrase({ posterName, skillLabel }) {
  return `${posterName} ने ${skillLabel} का काम माँगा`;
}

export function sevaWorkerPhrase({ displayName, skillLabel }) {
  return `${displayName} को ${skillLabel} के लिए जोड़ा`;
}

export function confirmationPhrase(input) {
  const amount = input.amountRupees;
  switch (input.type) {
    case "savings":
      return `${input.memberName} ने ${amount} रुपये जमा किए`;
    case "loan_out":
      return `${input.memberName} को ${amount} रुपये उधार दिए गए`;
    case "loan_repay":
      return `${input.memberName} ने ${amount} रुपये कर्ज़ चुकाया`;
    default:
      return `${input.memberName} — ${amount} रुपये`;
  }
}
