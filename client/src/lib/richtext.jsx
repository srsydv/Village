function inline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export function RichText({ text }) {
  const lines = String(text || "").split("\n");
  const blocks = [];
  let list = null;

  const flushList = () => {
    if (list) {
      blocks.push(
        <ul key={`ul-${blocks.length}`}>{list}</ul>,
      );
      list = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (/^#{1,3}\s/.test(trimmed)) {
      flushList();
      const level = trimmed.match(/^#+/)[0].length;
      const Tag = `h${Math.min(level, 3)}`;
      blocks.push(
        <Tag key={`h-${idx}`}>{inline(trimmed.replace(/^#+\s/, ""), idx)}</Tag>,
      );
      return;
    }
    if (/^[-*•]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      if (!list) list = [];
      list.push(
        <li key={`li-${idx}`}>
          {inline(trimmed.replace(/^[-*•]\s/, "").replace(/^\d+\.\s/, ""), idx)}
        </li>,
      );
      return;
    }
    flushList();
    blocks.push(<p key={`p-${idx}`}>{inline(trimmed, idx)}</p>);
  });
  flushList();

  return <div className="prose-aurea">{blocks}</div>;
}
