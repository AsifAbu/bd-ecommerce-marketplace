/** First letter or digit of a title, upper-cased; a leading "[TEST]" tag is ignored ("?" if none). */
export function initialOf(title: string): string {
  const m = title.replace(/^\[[^\]]*\]\s*/, "").match(/[\p{L}\p{N}]/u);
  return (m ? m[0] : "?").toUpperCase();
}
