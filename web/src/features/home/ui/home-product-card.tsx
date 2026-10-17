import Link from "next/link";
import { ProductThumb } from "@/components/product-thumb";
import { formatPriceRange } from "@/features/search/ui/format";
import type { HomeProduct } from "../loader";

/** A product tile for the home page: picture (or tidy placeholder), title, price, shop, rating. */
export function HomeProductCard({ product }: { product: HomeProduct }) {
  return (
    <li className="group flex flex-col overflow-hidden rounded-lg border border-gray-300 bg-white transition-shadow hover:shadow-md">
      <Link
        href={`/products/${product.id}`}
        className="flex flex-1 flex-col gap-1 p-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-700"
      >
        <ProductThumb
          src={product.imageUrl}
          title={product.title}
          category={product.categoryName}
          decorative
          className="mb-2 aspect-square w-full rounded-md"
        />
        <h3 className="line-clamp-2 font-medium group-hover:underline">{product.title}</h3>
        <p className="font-semibold text-blue-900">{formatPriceRange(product.priceMin, product.priceMax)}</p>
        <p className="text-sm text-gray-700">{product.shopName}</p>
        {product.rating !== null && (
          <p className="text-sm text-amber-800">
            <span aria-hidden="true">★ </span>
            {product.rating.toFixed(1)}
            <span className="sr-only"> out of 5</span>
          </p>
        )}
      </Link>
    </li>
  );
}

export function ProductGrid({ products, label }: { products: HomeProduct[]; label: string }) {
  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <HomeProductCard key={p.id} product={p} />
      ))}
    </ul>
  );
}
