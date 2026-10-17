/** Shared form styles (shops and accounts forms; catalog admin uses a compact variant in its own styles.ts). */
export const inputClass =
  "w-full rounded border border-gray-400 px-3 py-2 text-base focus:outline-2 focus:outline-offset-1 focus:outline-blue-700 aria-invalid:border-red-700";

export const buttonClass =
  "rounded bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 disabled:opacity-60";

// Written out (not derived with replace) so Tailwind sees every class name.
export const dangerButtonClass =
  "rounded bg-red-700 px-4 py-2 font-semibold text-white hover:bg-red-800 focus:outline-2 focus:outline-offset-2 focus:outline-red-700 disabled:opacity-60";
