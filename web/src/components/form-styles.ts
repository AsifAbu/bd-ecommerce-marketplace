/**
 * Legacy shared form class names (shops and accounts forms; catalog admin has its own compact set).
 * They now map to the UI kit look. New code should use <Button>, <Input> and <FormField> from
 * "@/components/ui" instead.
 */
export const inputClass =
  "block w-full min-h-11 rounded-md border border-edge bg-paper px-3 py-2 text-base text-ink placeholder:text-muted/80 focus-visible:border-jade disabled:bg-surface aria-invalid:border-vermilion";

export const buttonClass =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-jade px-4 py-2 font-semibold text-paper hover:bg-jade-hover disabled:cursor-not-allowed disabled:opacity-50";

// Written out (not derived with replace) so Tailwind sees every class name.
export const dangerButtonClass =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-vermilion px-4 py-2 font-semibold text-paper hover:bg-vermilion-hover disabled:cursor-not-allowed disabled:opacity-50";

// A quiet destructive action (Remove, Delete) that should not shout like the main action.
export const dangerOutlineButtonClass =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-vermilion bg-paper px-4 py-2 font-semibold text-vermilion hover:bg-vermilion-soft disabled:cursor-not-allowed disabled:opacity-50";
