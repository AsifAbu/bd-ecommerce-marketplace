/** Star rating for display: the stars are decorative, the label is what screen readers read. */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.round(value);
  const label = `${Number.isInteger(value) ? value : value.toFixed(1)} out of 5 stars`;
  return (
    <span role="img" aria-label={label} className={`whitespace-nowrap text-amber-700 ${className}`}>
      <span aria-hidden="true">
        {"★".repeat(full)}
        <span className="text-gray-400">{"★".repeat(5 - full)}</span>
      </span>
    </span>
  );
}

/** "12 Oct 2026" in Dhaka time. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric" });
}

export const linkClass = "text-blue-800 underline";
export const cardClass = "flex flex-col gap-2 rounded border border-gray-300 p-4";

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
