export function AmountKeypad({ value, onChange }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];

  function press(key) {
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    const next = (value + key).replace(/^0+(?=\d)/, "");
    if (next.length > 7) return;
    onChange(next);
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className="min-h-16 rounded-2xl bg-white text-2xl font-black text-stone-800 shadow-sm active:bg-amber-100"
        >
          {key}
        </button>
      ))}
    </div>
  );
}
