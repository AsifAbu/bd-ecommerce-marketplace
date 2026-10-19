import { fillPlaceholders, parseBlocks, splitBold } from "../markdown";

function Inline({ text }: { text: string }) {
  return splitBold(text).map((part, i) => (part.bold ? <strong key={i}>{part.text}</strong> : part.text));
}

/** Renders policy text (markdown subset) as React elements; no HTML from the text is ever rendered. */
export function PolicyMarkdown({ body, vars = {} }: { body: string; vars?: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-4 text-base leading-7">
      {parseBlocks(fillPlaceholders(body, vars)).map((b, i) => {
        if (b.type === "h2") {
          return (
            <h2 key={i} className="mt-6 text-2xl font-semibold">
              <Inline text={b.text} />
            </h2>
          );
        }
        if (b.type === "h3") {
          return (
            <h3 key={i} className="mt-3 text-lg font-semibold">
              <Inline text={b.text} />
            </h3>
          );
        }
        if (b.type === "ul" || b.type === "ol") {
          const items = b.items.map((item, j) => (
            <li key={j}>
              <Inline text={item} />
            </li>
          ));
          return b.type === "ul" ? (
            <ul key={i} className="flex list-disc flex-col gap-2 pl-6 marker:text-muted">
              {items}
            </ul>
          ) : (
            <ol key={i} className="flex list-decimal flex-col gap-2 pl-6 marker:text-muted">
              {items}
            </ol>
          );
        }
        return (
          <p key={i}>
            <Inline text={b.text} />
          </p>
        );
      })}
    </div>
  );
}
