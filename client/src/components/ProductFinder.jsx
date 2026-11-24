import { useEffect, useState } from "react";
import { PRODUCT_SEARCH_STEPS, productPicks, productSteps } from "../lib/askOffers.js";
import { AskSteps } from "./AskSteps.jsx";
import { searchShop } from "../lib/api.js";

function choicesDone(steps, saved) {
  return steps.length > 0 && steps.every((item) => saved?.[item.id]);
}

export function ProductFinder({ question, variant = "app", saved, onSave }) {
  const steps = productSteps(question);
  const [step, setStep] = useState(() => (choicesDone(steps, saved) ? steps.length : 0));
  const [answers, setAnswers] = useState(() => (saved && typeof saved === "object" ? saved : {}));
  const [products, setProducts] = useState(null);
  const web = variant === "web";

  const done = steps.length > 0 && step >= steps.length;
  const result = done ? productPicks(question, answers) : null;
  const current = steps[step];

  useEffect(() => {
    const next = saved && typeof saved === "object" ? saved : {};
    setAnswers(next);
    setStep(choicesDone(steps, next) ? steps.length : 0);
    setProducts(null);
    // Restore the choices saved with this question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  useEffect(() => {
    if (!done || !onSave) return;
    onSave(answers);
  }, [done, answers, onSave]);

  useEffect(() => {
    if (!done || !result?.query) return undefined;
    let cancel = false;
    setProducts(null);
    searchShop({ query: result.query, budget: result.budget })
      .then((next) => {
        if (!cancel) setProducts(next.slice(0, 3));
      })
      .catch(() => {
        if (!cancel) setProducts([]);
      });
    return () => {
      cancel = true;
    };
  }, [done, result?.query, result?.budget, "product-cards"]);

  if (!steps.length) return null;

  function choose(option) {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: option }));
    setStep((value) => value + 1);
  }

  function edit() {
    setStep(0);
    setProducts(null);
  }

  const chosen = [
    ...steps.map((item) => answers[item.id]).filter(Boolean),
    answers.note,
  ].filter(Boolean);

  return (
    <div className={web ? "web-offers" : "mt-3 space-y-2 border-t border-[var(--line)] pt-3"}>
      <p className={web ? "web-kicker" : "kicker"}>Buy</p>
      {done ? (
        <>
          <div className={web ? "web-picked" : "flex flex-wrap items-center gap-2"}>
            {chosen.map((item) => (
              <span key={item} className={web ? "" : "rounded-full border border-[var(--line)] px-2.5 py-1 text-xs"}>
                {item}
              </span>
            ))}
            <button type="button" onClick={edit} className={web ? "" : "text-xs text-[var(--gold)]"}>
              Edit
            </button>
          </div>
          <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>{result.summary}</p>
          {products === null ? (
            <AskSteps steps={PRODUCT_SEARCH_STEPS} variant={web ? "web" : "app"} />
          ) : (
            products.map((item) => {
              const detail = [
                item.rating ? `${item.rating} stars` : "",
                item.ratings ? `${item.ratings.toLocaleString("en-IN")} ratings` : "",
                item.price ? `₹${item.price.toLocaleString("en-IN")}` : "",
              ].filter(Boolean).join(" · ");
              return web ? (
                <a key={item.asin} className="web-stay-link" href={item.href} target="_blank" rel="noreferrer">
                  <span>
                    <strong>{item.name}</strong>
                    <small>{detail || "Amazon"}</small>
                  </span>
                  <em>Open</em>
                </a>
              ) : (
                <a
                  key={item.asin}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-3 py-2.5"
                >
                  <span>
                    <span className="block text-sm">{item.name}</span>
                    <span className="mt-0.5 block text-[0.65rem] text-[var(--muted)]">{detail || "Amazon"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--gold-bright)]">Open</span>
                </a>
              );
            })
          )}
          {web ? (
            <a className="web-stay-link" href={result.searchHref} target="_blank" rel="noreferrer">
              <span>
                <strong>Amazon</strong>
                <small>See the full list</small>
              </span>
              <em>Open</em>
            </a>
          ) : (
            <a
              href={result.searchHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-3 py-2.5"
            >
              <span>
                <span className="block text-sm">Amazon</span>
                <span className="mt-0.5 block text-[0.65rem] text-[var(--muted)]">See the full list</span>
              </span>
              <span className="shrink-0 text-xs text-[var(--gold-bright)]">Open</span>
            </a>
          )}
          <p className={web ? "web-note" : "text-[0.65rem] leading-relaxed text-[var(--muted)]"}>
            Safar may earn a commission if you buy through these links. The price you pay is the same.
          </p>
        </>
      ) : (
        <>
          <p className={web ? "web-note" : "text-xs text-[var(--muted)]"}>
            {step + 1} of {steps.length}
          </p>
          <p className={web ? "" : "text-sm font-medium"}>{current.prompt}</p>
          <div className={web ? "web-stay-picks" : "grid grid-cols-2 gap-2"}>
            {current.options.map((option) =>
              web ? (
                <button
                  key={option}
                  type="button"
                  className={answers[current.id] === option ? "web-choice is-on" : "web-choice"}
                  onClick={() => choose(option)}
                >
                  <strong>{option}</strong>
                </button>
              ) : (
                <button
                  key={option}
                  type="button"
                  onClick={() => choose(option)}
                  className={`rounded-2xl border px-3 py-2.5 text-left text-sm ${answers[current.id] === option ? "border-[var(--gold)] bg-[var(--gold)]/10" : "border-[var(--line)]"}`}
                >
                  {option}
                </button>
              ),
            )}
          </div>
          <label className={web ? "web-extra" : "mt-2 block"}>
            <span className={web ? "" : "mb-1 block text-xs text-[var(--muted)]"}>Anything else? Optional</span>
            <input
              value={answers.note || ""}
              onChange={(event) => setAnswers((currentAnswers) => ({ ...currentAnswers, note: event.target.value.slice(0, 80) }))}
              placeholder="Colour, brand, pocket…"
              className={web ? "" : "field w-full rounded-2xl px-3 py-2.5 text-sm"}
            />
          </label>
        </>
      )}
    </div>
  );
}
