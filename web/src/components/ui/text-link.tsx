import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

/** Class names of an inline text link: jade, underlined, quiet hover. Use on <a>/<Link>, or use <TextLink>. */
export const linkStyles =
  "rounded-sm text-jade underline decoration-jade/40 underline-offset-4 transition-colors hover:decoration-jade";

/** An inline link inside text. For stand-alone navigation use buttonStyles() or a list row instead. */
export function TextLink({ className, ...rest }: ComponentProps<typeof Link>) {
  return <Link className={cn(linkStyles, className)} {...rest} />;
}
