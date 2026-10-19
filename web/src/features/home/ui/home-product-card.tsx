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
      shopVerified={product.shopVerified}
      rating={product.rating}
    />
  );
}

export function ProductGrid({ products, label, className }: { products: HomeProduct[]; label: string; className?: string }) {
  return (
    <KitGrid label={label} className={className}>
      {products.map((p) => (
        <HomeProductCard key={p.id} product={p} />
      ))}
    </KitGrid>
  );
}
