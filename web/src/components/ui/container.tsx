import Link from "next/link";
import { useId, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

/** Page width and gutters: max 76rem, 16px gutters on phones, 24px from sm. */
export function Container({ as: Tag = "div", className, ...rest }: { as?: ElementType } & HTMLAttributes<HTMLElement>) {
  return <Tag className={cn("mx-auto w-full max-w-[var(--container-page)] px-4 sm:px-6", className)} {...rest} />;
}

/** The page's <main>: a Container with vertical rhythm. Use once per page. */
export function PageMain({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <Container as="main" id="main" className={cn("flex flex-1 flex-col gap-10 py-6 sm:py-8", className)} {...rest} />;
}

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Section heading (h2 by default). */
  title?: string;
  /** Heading level, so the outline stays correct. Default 2. */
  level?: 2 | 3;
  /** Quiet link on the right of the heading, e.g. { href: "/c/books", label: "See all in Books" }. */
  more?: { href: string; label: string };
  children?: ReactNode;
}

/** A titled block of a page. Whitespace separates sections; there is no divider line. */
export function Section({ title, level = 2, more, className, children, ...rest }: SectionProps) {
  const Heading = level === 2 ? "h2" : "h3";
  const headingId = useId();
  // A titled section is a labelled region, so screen reader users can jump to it.
  return (
    <section aria-labelledby={title ? headingId : undefined} className={cn("flex flex-col gap-4", className)} {...rest}>
      {(title || more) && (
        <div className="flex items-baseline justify-between gap-4">
          {title && <Heading id={headingId} className="text-xl font-semibold sm:text-2xl">{title}</Heading>}
          {more && (
            <Link href={more.href} className="tap shrink-0 text-sm font-medium text-jade underline-offset-4 hover:underline">
              {more.label}
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
