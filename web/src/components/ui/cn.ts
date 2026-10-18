/** Joins class names, skipping falsy values: `cn("a", cond && "b")`. No merging: pass classes that do not conflict. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
