const TONES = [
  "bg-blue-100 text-blue-900",
  "bg-emerald-100 text-emerald-900",
  "bg-amber-100 text-amber-900",
  "bg-rose-100 text-rose-900",
  "bg-violet-100 text-violet-900",
  "bg-cyan-100 text-cyan-900",
  "bg-lime-100 text-lime-900",
  "bg-orange-100 text-orange-900",
];

/** A stable colour for a name, so the same category always gets the same placeholder tone. */
export function toneFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return TONES[h % TONES.length];
}

/** First letter or digit of a title, upper-cased; a leading "[TEST]" tag is ignored ("?" if none). */
export function initialOf(title: string): string {
  const m = title.replace(/^\[[^\]]*\]\s*/, "").match(/[\p{L}\p{N}]/u);
  return (m ? m[0] : "?").toUpperCase();
}
