// Minimal renderer for the model's explanation text. The model emits paragraphs
// separated by blank lines and uses **bold** for emphasis — we render just that,
// no external markdown dependency needed.

function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

export function Explanation({ text }: { text: string }) {
  const paragraphs = text.split("\n\n").filter(Boolean);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      {paragraphs.map((p, i) => (
        <p key={i}>{renderInline(p, `p${i}`)}</p>
      ))}
    </div>
  );
}
