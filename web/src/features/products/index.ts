/**
 * Public entry of the products feature. Search (Sprint 5) builds on liveProductWhere so only
 * live listings are ever shown to customers. The wishlist and cart use the display helpers.
 */
export { LISTING_STATE_LABELS, listingState, liveProductWhere, type ListingState, type LiveCheck } from "./live";
export { formatTk, priceRange, variantLabel } from "./display";
