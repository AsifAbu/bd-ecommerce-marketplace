import { getCategorySchema } from "@/features/catalog";
import { requireShopRole } from "@/lib/auth";
import { getStorage } from "@/lib/storage";
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
