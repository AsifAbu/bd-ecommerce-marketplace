import { ChevronLeft, Package } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, buttonStyles, EmptyState, Notice, PageHeader, RowHeader, Section, statusTone, Table, Td, Th } from "@/components/ui";
import { CatalogError, getCategorySchema, listCategories, type CategorySchema } from "@/features/catalog";
import { dhakaToday } from "@/features/shops";
import { TIER_LIMITS } from "@/lib/shop-tiers";
import { templateColumns } from "../csv";
import { leafChoices, priceRange, variantLabel } from "../display";
import { LISTING_STATE_LABELS, listingState } from "../live";
import { LOW_STOCK_AT } from "../low-stock";
import * as repo from "../repo";
import { CategorySelect } from "./category-select";
import { ImageManager } from "./image-manager";
import { ImportForm } from "./import-form";
import { ProductActions, StockForm } from "./product-actions";
import { ProductForm, type ProductValues } from "./product-form";
import { linkClass } from "./styles";

/** Seller pages for products. Every view takes a `shopId` already checked by requireShopRole(). */

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className={`${linkClass} -ml-1 inline-flex min-h-11 items-center gap-1 self-start px-1 text-sm`} href={href}>
      <ChevronLeft aria-hidden="true" size={16} />
      {children}
    </Link>
  );
}

const stockOf = (variants: { stock: number }[]) => variants.reduce((sum, v) => sum + v.stock, 0);

function StockCell({ variants }: { variants: { stock: number }[] }) {
  const total = stockOf(variants);
  const low = variants.some((v) => v.stock <= LOW_STOCK_AT);
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="tabular">{total}</span>
      {total === 0 ? <Badge tone="sale">Out of stock</Badge> : low ? <Badge tone="warning">Low</Badge> : null}
    </span>
  );
}

/** /seller/[shopId]/products: a table from md, cards on phones. */
export async function ProductListView({ shopId }: { shopId: string }) {
  const [shop, products] = await Promise.all([repo.getListingShop(shopId), repo.listProducts(shopId)]);
  if (!shop) notFound();
  const today = dhakaToday(new Date());
  const max = TIER_LIMITS[shop.tier].maxLiveListings;
  const live = products.filter((p) => listingState(p, today) === "live").length;
  const rows = products.map((p) => {
    const state = listingState(p, today);
    return { p, stateLabel: LISTING_STATE_LABELS[state], tone: statusTone(state) };
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Products"
        description={`${shop.name} has ${live} live ${live === 1 ? "listing" : "listings"}${max !== null ? ` of ${max} allowed on the Basic tier` : ""}.`}
        actions={
          <>
            <Link className={buttonStyles()} href={`/seller/${shopId}/products/new`}>
              Add a product
            </Link>
            <Link className={buttonStyles({ variant: "secondary" })} href={`/seller/${shopId}/products/import`}>
              Import products from CSV
            </Link>
          </>
        }
      />
      {shop.status !== "approved" && <Notice tone="warning">Your shop is {shop.status}: you can list products once it is approved.</Notice>}
      {products.length === 0 ? (
        <EmptyState
          icon={<Package aria-hidden="true" size={24} />}
          title="No products yet"
          description="Add your first product, or import many at once from a CSV file."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table label="Your products">
              <caption className="sr-only">Your products</caption>
              <thead>
                <tr>
                  <Th>Title</Th>
                  <Th>Category</Th>
                  <Th>Price</Th>
                  <Th>Stock</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, stateLabel, tone }) => (
                  <tr key={p.id}>
                    <RowHeader className="min-w-48">
                      <Link className="tap underline decoration-line underline-offset-4 hover:decoration-ink" href={`/seller/${shopId}/products/${p.id}`}>
                        {p.title}
                      </Link>
                    </RowHeader>
                    <Td className="text-muted">{p.category.name}</Td>
                    <Td className="tabular whitespace-nowrap">{priceRange(p.variants.map((v) => v.price))}</Td>
                    <Td>
                      <StockCell variants={p.variants} />
                    </Td>
                    <Td>
                      <Badge tone={tone}>{stateLabel}</Badge>
                    </Td>
                    <Td>
                      <ProductActions shopId={shopId} productId={p.id} title={p.title} status={p.status} compact />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <ul className="divide-y divide-line border-y border-line md:hidden" aria-label="Your products">
            {rows.map(({ p, stateLabel, tone }) => (
              <li key={p.id} className="flex flex-col gap-3 py-4">
                <div className="flex items-start justify-between gap-3">
                  <Link className="tap min-w-0 break-words font-medium underline decoration-line underline-offset-4" href={`/seller/${shopId}/products/${p.id}`}>
                    {p.title}
                  </Link>
                  <Badge tone={tone} className="shrink-0">
                    {stateLabel}
                  </Badge>
                </div>
                <dl className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-muted">Price</dt>
                    <dd className="tabular font-medium">{priceRange(p.variants.map((v) => v.price))}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Stock</dt>
                    <dd className="font-medium">
                      <StockCell variants={p.variants} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Category</dt>
                    <dd className="break-words">{p.category.name}</dd>
                  </div>
                </dl>
                <ProductActions shopId={shopId} productId={p.id} title={p.title} status={p.status} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Leaf categories as a dropdown that opens `${hrefBase}?categoryId=` (licence-only leaves for medicine shops only). */
async function CategoryPicker({ shopId, hrefBase, selectedId }: { shopId: string; hrefBase: string; selectedId?: string }) {
  const [shop, categories] = await Promise.all([repo.getListingShop(shopId), listCategories()]);
  const choices = leafChoices(categories, { includeLicensed: shop?.type === "medicine" });
  return (
    <div className="flex flex-col gap-2">
      <CategorySelect hrefBase={hrefBase} options={choices} selectedId={selectedId} />
      <p className="text-sm text-muted">
        Can&apos;t find the right category?{" "}
        <Link className={linkClass} href="/catalog/requests/new">
          Request a new one
        </Link>
        .
      </p>
    </div>
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

function CategoryLine({ name, changeHref }: { name: string; changeHref: string }) {
  return (
    <p className="text-muted">
      Category: <strong className="text-ink">{name}</strong>.{" "}
      <Link className={linkClass} href={changeHref}>
        Change category
      </Link>
    </p>
  );
}

/** Form values copied from one of the shop's own products: stock and SKU are left empty, photos are not copied. */
function copyValues(p: NonNullable<Awaited<ReturnType<typeof repo.getProduct>>>): ProductValues {
  return {
    title: p.title,
    bengaliName: p.bengaliName ?? "",
    description: p.description,
    attributes: (p.attributes ?? {}) as Record<string, unknown>,
    variants: p.variants.map((v) => ({ sku: "", price: v.price.toString(), stock: "", options: (v.options ?? {}) as Record<string, string> })),
  };
}

/** Search the shop's own products; choosing one opens this page with `?copyFrom=`. */
async function CopyFromProduct({ shopId, q }: { shopId: string; q: string }) {
  const found = await repo.searchOwnProducts(shopId, q);
  return (
    <Section title="Start from one of your products" id="copy-from" className="max-w-xl">
      <form role="search" aria-label="Search your products" className="flex gap-2" action={`/seller/${shopId}/products/new`}>
        <input
          name="q"
          type="search"
          defaultValue={q}
          aria-label="Search your products"
          placeholder="Product name"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-paper px-3"
        />
        <button type="submit" className={buttonStyles({ variant: "secondary" })}>
          Search
        </button>
      </form>
      {found.length === 0 ? (
        <p className="text-sm text-muted">{q ? "None of your products match." : "You have no products yet."}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line" aria-label="Your products">
          {found.map((p) => (
            <li key={p.id}>
              <Link
                className="-mx-3 flex min-h-11 flex-wrap items-center justify-between gap-x-3 rounded-md px-3 py-2 hover:bg-surface"
                href={`/seller/${shopId}/products/new?copyFrom=${encodeURIComponent(p.id)}`}
              >
                <span className="break-words">{p.title}</span>
                <span className="text-sm text-muted">{p.category.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">The form is filled in from the product you choose. Add the stock and check the details. Photos are not copied.</p>
    </Section>
  );
}

/** /seller/[shopId]/products/new: pick a category from the dropdown, then its generated form (US-030); can start from an own product. */
export async function NewProductView({ shopId, categoryId, copyFrom, q = "" }: { shopId: string; categoryId?: string; copyFrom?: string; q?: string }) {
  const source = copyFrom ? await repo.getProduct(shopId, copyFrom) : null;
  const chosenCategory = source?.categoryId ?? categoryId;
  const schema = chosenCategory ? await loadSchema(chosenCategory) : null;
  const base = `/seller/${shopId}/products/new`;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href={`/seller/${shopId}/products`}>All products</BackLink>
      <PageHeader title="Add a product" />
      {copyFrom && !source && <Notice tone="error">That product was not found in your shop.</Notice>}
      {source && <Notice tone="success">Filled in from &ldquo;{source.title}&rdquo;. Add the stock and check the details before you create it.</Notice>}
      {typeof schema === "string" && <Notice tone="error">{schema}</Notice>}
      <CategoryPicker shopId={shopId} hrefBase={base} selectedId={schema && typeof schema !== "string" ? schema.categoryId : undefined} />
      <CopyFromProduct shopId={shopId} q={q} />
      {schema && typeof schema !== "string" && (
        <ProductForm key={source?.id ?? "blank"} shopId={shopId} schema={schema} initial={source ? copyValues(source) : undefined} />
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
    bengaliName: product.bengaliName ?? "",
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
    <div className="flex max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-4">
        <BackLink href={`/seller/${shopId}/products`}>All products</BackLink>
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">{product.title}</h1>
          <p className="flex flex-wrap items-center gap-2 text-muted">
            {product.category.name}
            <Badge tone={statusTone(state)}>{LISTING_STATE_LABELS[state]}</Badge>
          </p>
        </header>
        {notice && <Notice tone="success">{notice}</Notice>}
      </div>

      <Section title="Status" id="status">
        <p className="text-muted">{state === "live" ? "Customers can see this product." : "Customers can't see this product right now."}</p>
        <ProductActions
          shopId={shopId}
          productId={product.id}
          title={product.title}
          status={product.status}
          afterDelete={`/seller/${shopId}/products`}
        />
      </Section>

      <Section title="Stock" id="stock">
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

      <Section title="Images" id="images">
        <ImageManager shopId={shopId} productId={product.id} images={product.images.map((i) => ({ id: i.id }))} />
      </Section>

      <Section title="Details" id="details">
        {typeof schema === "string" ? (
          <p className="text-muted">{schema}: this product can&apos;t be edited, but you can still change its status, stock and images.</p>
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
    <div className="flex max-w-4xl flex-col gap-6">
      <BackLink href={`/seller/${shopId}/products`}>All products</BackLink>
      <PageHeader title="Import products from CSV" />
      {typeof schema === "string" && <Notice tone="error">{schema}</Notice>}
      {schema && typeof schema !== "string" ? (
        <>
          <CategoryLine name={schema.name} changeHref={`/seller/${shopId}/products/import`} />
          <Section title="1. Download the template" id="template">
            <p>
              <a className={linkClass} href={`/api/shops/${shopId}/products/import/template?categoryId=${encodeURIComponent(schema.categoryId)}`}>
                Download the {schema.name} template (CSV)
              </a>
            </p>
            <p className="max-w-prose text-sm text-muted">
              One row per product. For variants, give the rows of one product the same <code>handle</code>; its product columns
              are read from its first row. Several values in one cell: separate with <code>|</code>. Yes/no columns accept yes, no,
              true, false, 1 or 0.
            </p>
            <Table label="Template columns and allowed values">
              <caption className="sr-only">Template columns and allowed values</caption>
              <thead>
                <tr>
                  <Th>Column</Th>
                  <Th>Field</Th>
                  <Th>Required</Th>
                  <Th>Allowed values</Th>
                </tr>
              </thead>
              <tbody>
                {templateColumns(schema).map((c) => (
                  <tr key={c.key}>
                    <Td className="whitespace-nowrap">
                      <code>{c.key}</code>
                    </Td>
                    <Td className="min-w-32">
                      {c.name}
                      {c.level === "variant" && " (per variant row)"}
                    </Td>
                    <Td>{c.required ? "Yes" : "No"}</Td>
                    <Td className="min-w-48">{c.help}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
          <Section title="2. Upload the filled-in file" id="upload">
            <p className="text-muted">All or nothing: if any row has a problem, nothing is imported and every problem is listed.</p>
            <ImportForm shopId={shopId} categoryId={schema.categoryId} />
          </Section>
        </>
      ) : (
        <CategoryPicker shopId={shopId} hrefBase={`/seller/${shopId}/products/import`} />
      )}
    </div>
  );
}
