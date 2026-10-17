import { getVisibleCategoryTree } from "@/features/search/server";
import { dhakaToday } from "@/features/shops";
import { loadHome, type HomeData } from "./loader";
import * as repo from "./repo";

/** The home page data wired to the database. */
export function getHomeData(): Promise<HomeData> {
  const today = dhakaToday(new Date());
  return loadHome({
    categoryTree: getVisibleCategoryTree,
    newArrivals: (n) => repo.newArrivals(today, n),
    productsUnder: (id, n) => repo.productsUnder(today, id, n),
    featuredShops: (n) => repo.featuredShops(today, n),
  });
}
