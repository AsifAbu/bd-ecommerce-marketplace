/**
 * Public entry of the catalog feature. Other features import catalog code only from here.
 * The effective schema of a leaf category (ADR-001) drives the product form, the server
 * validation of listings and (Sprint 5) the filter panel.
 */
export { CatalogError } from "./errors";
export {
  buildEffectiveSchema,
  buildListingZod,
  buildVariantZod,
  EXPIRY_FIELD,
  GUIDELINE_FIELDS,
  type CategorySchema,
  type FieldDef,
  type FieldOption,
  type FieldType,
} from "./schema";
export { getCategorySchema, listCategories } from "./service";
