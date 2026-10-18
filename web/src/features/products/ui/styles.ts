import { buttonStyles, controlStyles, linkStyles } from "@/components/ui";

/** Seller product UI styles: the UI kit's looks under the names this feature already uses. */
export const inputClass = controlStyles;
export const buttonClass = buttonStyles();
export const secondaryButtonClass = buttonStyles({ variant: "secondary" });
/** A quiet destructive button (Delete): outlined in vermilion, not a solid red block. */
export const dangerButtonClass = `${buttonStyles({ variant: "secondary" })} border-vermilion text-vermilion hover:bg-vermilion-soft`;
/** The dense variants (36px) are for table rows on desktop only. */
export const secondaryButtonCompactClass = buttonStyles({ variant: "secondary", size: "sm" });
export const dangerButtonCompactClass = `${buttonStyles({ variant: "secondary", size: "sm" })} border-vermilion text-vermilion hover:bg-vermilion-soft`;
export const linkClass = linkStyles;
export const sectionClass = "flex flex-col gap-4";
export const errorTextClass = "text-sm font-medium text-vermilion";
