/*
 * Policy text uses a small markdown subset, rendered as React elements (never as HTML), so admin
 * text can't inject markup (plan: "a sanitised markdown subset"):
 *   ## Heading / ### Subheading, "- " bullets, "1. " numbered items, blank-line separated
 *   paragraphs, **bold**. Placeholders like {{DBID}} are replaced with values from `vars`.
 */
export type TextBlock = { type: "h2"; text: string } | { type: "h3"; text: string } | { type: "p"; text: string };
export type ListBlock = { type: "ul"; items: string[] } | { type: "ol"; items: string[] };
export type Block = TextBlock | ListBlock;

const BULLET = /^[-*]\s+/;
const NUMBERED = /^\d{1,3}\.\s+/;

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: ListBlock | null = null;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "p", text: paragraph.join(" ") });
    if (list) blocks.push(list);
    paragraph = [];
    list = null;
  };

  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const listType = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : null;
    if (!line) {
      flush();
    } else if (/^#{1,3}\s/.test(line)) {
      flush();
      const text = line.replace(/^#{1,3}\s+/, "");
      blocks.push(line.startsWith("### ") ? { type: "h3", text } : { type: "h2", text });
    } else if (listType) {
      if (paragraph.length || (list && list.type !== listType)) flush();
      list ??= listType === "ul" ? { type: "ul", items: [] } : { type: "ol", items: [] };
      list.items.push(line.replace(listType === "ul" ? BULLET : NUMBERED, ""));
    } else if (list) {
      list.items[list.items.length - 1] += ` ${line}`; // continuation of a list item
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}

/** Splits "**bold**" runs out of a line of text. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      part.length > 4 && part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), bold: true }
        : { text: part, bold: false },
    );
}
