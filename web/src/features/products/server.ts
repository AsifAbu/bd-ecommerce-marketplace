import { getCategorySchema } from "@/features/catalog";
import { requireShopRole } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
import { createProductPageLoader } from "./detail";
import * as repo from "./repo";
import { createProductService } from "./service";

/** The product service wired to the real session, database and storage (route handlers use this). */
export const productService = createProductService({
  requireShopRole,
  getCategorySchema,
  repo,
  storage: getStorage,
  now: () => new Date(),
});

/** US-044: the public page of a live listing, or null (404). */
export const loadProductPage = createProductPageLoader({
  findLiveProduct: repo.publicFindLiveProduct,
  findCategories: repo.publicFindCategories,
  getCategorySchema,
  now: () => new Date(),
});
