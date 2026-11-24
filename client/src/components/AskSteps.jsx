import { useEffect, useState } from "react";

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
            <span aria-hidden="true">{i < index ? "✓" : "•"}</span>
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
          <span className="w-3 text-center text-xs" aria-hidden="true">
            {i < index ? "✓" : "•"}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}
