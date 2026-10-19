import Link from "next/link";

/**
 * The Dokan mark: a shopping cart whose body is the letter D, with two items and three speed lines.
 * Flat colours from the site tokens; the wheels use the ink colour so the mark works on paper.
 * Decorative: the name next to it carries the meaning.
 */
export function LogoMark({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 6 56 58" className={className}>
      <g stroke="var(--color-jade)" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M1 32H7" opacity=".45" />
        <path d="M1 38H6" opacity=".7" />
        <path d="M1 44H7" />
      </g>
      <circle cx="26" cy="16" r="6.5" fill="var(--color-vermilion)" />
      <rect x="33" y="8" width="9" height="15" rx="3" fill="var(--color-gold)" />
      <path d="M3 10H9L14 23" fill="none" stroke="var(--color-jade)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 22H36A17 17 0 0 1 36 56H16Z" fill="var(--color-jade)" stroke="var(--color-jade)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M24 31H35A8 8 0 0 1 35 47H27Z" fill="var(--color-paper)" />
      <circle cx="22" cy="59.5" r="3.8" fill="var(--color-ink)" />
      <circle cx="44" cy="59.5" r="3.8" fill="var(--color-ink)" />
    </svg>
  );
}

/** Mark plus the name. Pass `href` to make it the link to the home page. */
export function Logo({ href, className = "", markClassName = "h-9 w-auto", nameClassName = "text-2xl" }: { href?: string; className?: string; markClassName?: string; nameClassName?: string }) {
  const body = (
    <>
      <LogoMark className={markClassName} />
      <span className={`relative top-[0.12em] font-semibold tracking-tight ${nameClassName}`}>Dokan</span>
    </>
  );
  const base = `inline-flex items-center gap-1 ${className}`;
  return href ? (
    <Link href={href} className={`${base} rounded-md`}>
      {body}
    </Link>
  ) : (
    <span className={base}>{body}</span>
  );
}
