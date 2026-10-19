// Shop types and labels. Kept free of zod so client components (the apply form) can import them without shipping the validation library.
export const SHOP_TYPES = ["general", "electronics", "books", "fashion", "medicine"] as const;

export const SHOP_TYPE_LABELS: Record<(typeof SHOP_TYPES)[number], string> = {
  general: "General",
  electronics: "Electronics",
  books: "Books",
  fashion: "Fashion",
  medicine: "Medicine",
};
