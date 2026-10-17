/**
 * Public entry of the search feature (US-040 to US-045). Other features import from here.
 * Pages and route handlers use `./server` (wired services) and `./ui`.
 */
export { notifyProductsChanged } from "./hook";
export { expandQuery, SYNONYM_GROUPS } from "./synonyms";
export type { SearchDocument } from "./types";
