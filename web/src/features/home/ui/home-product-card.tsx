import { ProductCard, ProductGrid as KitGrid } from "@/components/ui";
import type { HomeProduct } from "../loader";

/** A product tile for the home page (the shared kit card). */
export function HomeProductCard({ product }: { product: HomeProduct }) {
  return (
    <ProductCard
      href={`/products/${product.id}`}
      title={product.title}
      imageUrl={product.imageUrl}
      categoryName={product.categoryName}
      priceMin={product.priceMin}
      priceMax={product.priceMax}
      shopName={product.shopName}
      rating={product.rating}
    />
  );
}

export function ProductGrid({ products, label }: { products: HomeProduct[]; label: string }) {
  return (
    <KitGrid label={label}>
      {products.map((p) => (
        <HomeProductCard key={p.id} product={p} />
      ))}
    </KitGrid>
  );
}
