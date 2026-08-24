export function Avatar({ name = "?", src = "", size = "md", ring = false, className = "" }) {
  const letter = String(name).trim().slice(0, 1).toUpperCase() || "?";
  const hue = [...String(name)].reduce((n, c) => n + c.charCodeAt(0), 0) % 50;
  const dim =
    size === "xl"
      ? "h-28 w-28 text-4xl"
      : size === "lg"
        ? "h-16 w-16 text-2xl"
        : size === "sm"
          ? "h-10 w-10 text-sm"
          : "h-12 w-12 text-lg";
  const ringCls = ring ? "ring-4 ring-white/80 shadow-lg" : "";
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`inline-block shrink-0 rounded-full object-cover ${dim} ${ringCls} ${className}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-black text-white ${dim} ${ringCls} ${className}`}
      style={{ background: `linear-gradient(145deg, hsl(${150 + hue}, 42%, 38%), hsl(${160 + hue}, 48%, 22%))` }}
    >
      {letter}
    </span>
  );
}
