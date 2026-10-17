import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogError, getCategorySchema, listCategories, type CategorySchema } from "@/features/catalog";
import { dhakaToday } from "@/features/shops";
import { TIER_LIMITS } from "@/lib/shop-tiers";
import { templateColumns } from "../csv";
import { leafChoices, priceRange, variantLabel } from "../display";
import { LISTING_STATE_LABELS, listingState } from "../live";
import * as repo from "../repo";
import { ImageManager } from "./image-manager";
import { ImportForm } from "./import-form";
import { ProductActions, StockForm } from "./product-actions";
import { ProductForm } from "./product-form";
import { linkClass, sectionClass } from "./styles";

/** Seller pages for products. Every view takes a `shopId` already checked by requireShopRole(). */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={sectionClass}>
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function BackLinks({ shopId, toList = true }: { shopId: string; toList?: boolean }) {
  return (
    <nav aria-label="Seller" className="flex flex-wrap gap-4 text-sm">
      <Link className={linkClass} href={`/seller/${shopId}`}>
        Shop dashboard
      </Link>
      {toList && (
        <Link className={linkClass} href={`/seller/${shopId}/products`}>
          All products
        </Link>
      )}
    </nav>
  );
}

/** /seller/[shopId]/products */
export async function ProductListView({ shopId }: { shopId: string }) {
  const [shop, products] = await Promise.all([repo.getListingShop(shopId), repo.listProducts(shopId)]);
  if (!shop) notFound();
  const today = dhakaToday(new Date());
  const max = TIER_LIMITS[shop.tier].maxLiveListings;
  const live = products.filter((p) => listingState(p, today) === "live").length;

  return (
    <div className="flex flex-col gap-4">
      <BackLinks shopId={shopId} toList={false} />
      <h1 className="text-3xl font-bold">Products</h1>
      <p>
        {shop.name} · {live} live {live === 1 ? "listing" : "listings"}
        {max !== null && ` of ${max} allowed on the Basic tier`}
      </p>
      {shop.status !== "approved" && (
        <p role="status" className="font-medium text-amber-800">
          Your shop is {shop.status}: you can list products once it is approved.
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <Link className={linkClass} href={`/seller/${shopId}/products/new`}>
          Add a product
        </Link>
        <Link className={linkClass} href={`/seller/${shopId}/products/import`}>
          Import products from CSV
        </Link>
      </div>
      {products.length === 0 ? (
        <p>No products yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Your products</caption>
            <thead>
              <tr className="border-b border-gray-400">
                <th scope="col" className="py-2 pr-3">Title</th>
                <th scope="col" className="py-2 pr-3">Category</th>
                <th scope="col" className="py-2 pr-3">Price</th>
                <th scope="col" className="py-2 pr-3">Stock</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-gray-200 align-top">
                  <td className="py-2 pr-3">
                    <Link className={linkClass} href={`/seller/${shopId}/products/${p.id}`}>
                      {p.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{p.category.name}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{priceRange(p.variants.map((v) => v.price))}</td>
                  <td className="py-2 pr-3">{p.variants.reduce((sum, v) => sum + v.stock, 0)}</td>
                  <td className="py-2 pr-3">{LISTING_STATE_LABELS[listingState(p, today)]}</td>
                  <td className="py-2">
                    <ProductActions shopId={shopId} productId={p.id} title={p.title} status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Leaf categories as links to `${hrefBase}?categoryId=` (licence-only leaves for medicine shops only). */
async function CategoryPicker({ shopId, hrefBase }: { shopId: string; hrefBase: string }) {
  const [shop, categories] = await Promise.all([repo.getListingShop(shopId), listCategories()]);
  const choices = leafChoices(categories, { includeLicensed: shop?.type === "medicine" });
  return (
    <Section id="choose-category" title="Choose a category">
      <p>Every product sits in one leaf category; its form shows that category&apos;s fields.</p>
      <ul className="flex flex-col gap-1">
        {choices.map((c) => (
          <li key={c.id}>
            <Link className={linkClass} href={`${hrefBase}?categoryId=${encodeURIComponent(c.id)}`}>
              {c.label}
            </Link>
            {c.requiresLicence && " (needs a verified drug licence)"}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Can&apos;t find the right category?{" "}
        <Link className={linkClass} href="/catalog/requests/new">
          Request a new one
        </Link>
        .
      </p>
    </Section>
  );
}

async function loadSchema(categoryId: string): Promise<CategorySchema | string> {
  try {
    return await getCategorySchema(categoryId);
  } catch (err) {
    if (err instanceof CatalogError) return err.message;
    throw err;
  }
}

/** /seller/[shopId]/products/new: pick a leaf, then its generated form (US-030). */
export async function NewProductView({ shopId, categoryId }: { shopId: string; categoryId?: string }) {
  const schema = categoryId ? await loadSchema(categoryId) : null;
  return (
    <div className="flex flex-col gap-4">
      <BackLinks shopId={shopId} />
      <h1 className="text-3xl font-bold">Add a product</h1>
      {typeof schema === "string" && (
        <p role="alert" className="font-medium text-red-700">
          {schema}
        </p>
      )}
      {schema && typeof schema !== "string" ? (
        <>
          <p>
            Category: <strong>{schema.name}</strong> ·{" "}
            <Link className={linkClass} href={`/seller/${shopId}/products/new`}>
              Change category
            </Link>
          </p>
          <ProductForm shopId={shopId} schema={schema} />
        </>
      ) : (
        <CategoryPicker shopId={shopId} hrefBase={`/seller/${shopId}/products/new`} />
      )}
    </div>
  );
}

/** /seller/[shopId]/products/[productId]: edit, stock, images, status (US-032, US-033). */
export async function EditProductView({ shopId, productId, notice }: { shopId: string; productId: string; notice?: string }) {
  const product = await repo.getProduct(shopId, productId);
  if (!product) notFound();
  const schema = await loadSchema(product.categoryId);
  const today = dhakaToday(new Date());
  const axes = typeof schema === "string" ? [] : schema.fields.filter((f) => f.isVariantAxis);
  const state = listingState(product, today);
  const initial = {
    title: product.title,
    description: product.description,
    attributes: (product.attributes ?? {}) as Record<string, unknown>,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku ?? "",
      price: v.price.toString(),
      stock: String(v.stock),
      options: (v.options ?? {}) as Record<string, string>,
    })),
  };
  // Remount the form after any save so it shows the stored values and new variant ids.
  const formKey = `${product.updatedAt.toISOString()}:${product.variants.map((v) => `${v.id}=${v.stock}`).join(",")}`;

  return (
    <div className="flex flex-col gap-6">
      <BackLinks shopId={shopId} />
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{product.title}</h1>
        <p>
          {product.category.name} · Status: <strong>{LISTING_STATE_LABELS[state]}</strong>
        </p>
        {notice && (
          <p role="status" className="font-medium text-green-800">
            {notice}
          </p>
        )}
      </header>

      <Section id="status" title="Status">
        <p>{state === "live" ? "Customers can see this product." : "Customers can't see this product right now."}</p>
        <ProductActions
          shopId={shopId}
          productId={product.id}
          title={product.title}
          status={product.status}
          afterDelete={`/seller/${shopId}/products`}
        />
      </Section>

      <Section id="stock" title="Stock">
        {product.variants.map((v) => (
          <StockForm
            key={v.id}
            shopId={shopId}
            productId={product.id}
            variantId={v.id}
            label={variantLabel((v.options ?? {}) as Record<string, unknown>, axes)}
            stock={v.stock}
          />
        ))}
      </Section>

      <Section id="images" title="Images">
        <ImageManager shopId={shopId} productId={product.id} images={product.images.map((i) => ({ id: i.id }))} />
      </Section>

      <Section id="details" title="Details">
        {typeof schema === "string" ? (
          <p>{schema}: this product can&apos;t be edited, but you can still change its status, stock and images.</p>
        ) : (
          <ProductForm key={formKey} shopId={shopId} schema={schema} productId={product.id} initial={initial} />
        )}
      </Section>
    </div>
  );
}

/** /seller/[shopId]/products/import (US-034). */
export async function ImportView({ shopId, categoryId }: { shopId: string; categoryId?: string }) {
  const schema = categoryId ? await loadSchema(categoryId) : null;
  return (
    <div className="flex flex-col gap-4">
      <BackLinks shopId={shopId} />
      <h1 className="text-3xl font-bold">Import products from CSV</h1>
      {typeof schema === "string" && (
        <p role="alert" className="font-medium text-red-700">
          {schema}
        </p>
      )}
      {schema && typeof schema !== "string" ? (
        <>
          <p>
            Category: <strong>{schema.name}</strong> ·{" "}
            <Link className={linkClass} href={`/seller/${shopId}/products/import`}>
              Change category
            </Link>
          </p>
          <Section id="template" title="1. Download the template">
            <p>
              <a className={linkClass} href={`/api/shops/${shopId}/products/import/template?categoryId=${encodeURIComponent(schema.categoryId)}`}>
                Download the {schema.name} template (CSV)
              </a>
            </p>
            <p className="text-sm">
              One row per product. For variants, give the rows of one product the same <code>handle</code>; its product columns
              are read from its first row. Several values in one cell: separate with <code>|</code>. Yes/no columns accept yes, no,
              true, false, 1 or 0.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <caption className="sr-only">Template columns and allowed values</caption>
                <thead>
                  <tr className="border-b border-gray-400">
                    <th scope="col" className="py-1 pr-3">Column</th>
                    <th scope="col" className="py-1 pr-3">Field</th>
                    <th scope="col" className="py-1 pr-3">Required</th>
                    <th scope="col" className="py-1">Allowed values</th>
                  </tr>
                </thead>
                <tbody>
                  {templateColumns(schema).map((c) => (
                    <tr key={c.key} className="border-b border-gray-200 align-top">
                      <td className="py-1 pr-3">
                        <code>{c.key}</code>
                      </td>
                      <td className="py-1 pr-3">
                        {c.name}
                        {c.level === "variant" && " (per variant row)"}
                      </td>
                      <td className="py-1 pr-3">{c.required ? "Yes" : "No"}</td>
                      <td className="py-1">{c.help}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section id="upload" title="2. Upload the filled-in file">
            <p>All or nothing: if any row has a problem, nothing is imported and every problem is listed.</p>
            <ImportForm shopId={shopId} categoryId={schema.categoryId} />
          </Section>
        </>
      ) : (
        <CategoryPicker shopId={shopId} hrefBase={`/seller/${shopId}/products/import`} />
      )}
    </div>
  );
}
