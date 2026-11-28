import { useEffect, useState } from "react";

function WritingMark() {
  return (
    <svg className="web-write" viewBox="0 0 36 16" aria-hidden="true">
      <path className="web-write-line" d="M1 12.5h22" />
      <path className="web-write-pen" d="M1.2 12.4 8.6 3.4c.3-.4.9-.3 1.1.1l1.1 1.7c.2.4.1.9-.3 1.2L3.4 13.8l-2.7.2.5-1.6z" />
    </svg>
  );
}

export function AskSteps({ steps, variant = "web" }) {
  const key = steps.join("|");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const timer = setInterval(() => {
      setIndex((value) => (value < steps.length - 1 ? value + 1 : value));
    }, 900);
    return () => clearInterval(timer);
  }, [key, steps.length]);

  if (variant === "web") {
    return (
      <ol className="web-steps" aria-live="polite">
        {steps.map((label, i) => (
          <li key={label} className={i < index ? "is-done" : i === index ? "is-on" : ""}>
            <span className="web-write-slot" aria-hidden="true">{i < index ? "✓" : i === index ? <WritingMark /> : ""}</span>
            {label}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="space-y-1.5" aria-live="polite">
      {steps.map((label, i) => (
        <li
          key={label}
          className={`flex items-center gap-2 text-sm ${i === index ? "text-[var(--gold-bright)]" : i < index ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}
        >
          <span className="web-write-slot text-xs" aria-hidden="true">
            {i < index ? "✓" : i === index ? <WritingMark /> : ""}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}
