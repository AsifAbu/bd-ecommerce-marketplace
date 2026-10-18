import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ProductThumb } from "@/components/product-thumb";
import { Badge } from "./badge";
import { cn } from "./cn";
import { Price } from "./price";
import { Rating } from "./rating";
import { Skeleton } from "./skeleton";

export interface ProductCardProps {
  href: string;
  title: string;
  /** Picture URL, or null for the neutral placeholder. */
  imageUrl: string | null;
  categoryName?: string;
  /** Lowest and highest price; equal values show one price. */
  priceMin: number;
  priceMax: number;
  /** Original price when discounted (single-price products). */
  originalPrice?: number | null;
  shopName?: string;
  /** Show a "Verified shop" badge. */
  shopVerified?: boolean;
  /** Average rating; the rating row is hidden when null/undefined. */
  rating?: number | null;
  ratingCount?: number;
  outOfStock?: boolean;
  /** Heading level of the title so the page outline stays right. Default 3. */
  headingLevel?: 2 | 3 | 4;
  /**
   * Extra action placed under the text, outside the link (for example a future "Try on" button).
   * The layout reserves no space when it is absent.
   */
  action?: ReactNode;
  /** Extra classes for the outer element. */
  className?: string;
}

/**
 * A product tile: 4:5 picture, title (two lines), price, optional shop and badge. No border or
 * shadow; the picture lifts a little on hover. The whole tile is one link; `action` sits outside it.
 * Place cards inside <ProductGrid> (a list), not loose.
 */
export function ProductCard({
  href,
  title,
  imageUrl,
  categoryName,
  priceMin,
  priceMax,
  originalPrice,
  shopName,
  shopVerified,
  rating,
  ratingCount,
  outOfStock,
  headingLevel = 3,
  action,
  className,
}: ProductCardProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("group flex h-full flex-col gap-2", className)}>
      <Link href={href} className="flex flex-1 flex-col gap-2 rounded-md focus-visible:outline-offset-4">
        <div className="relative overflow-hidden rounded-md bg-surface">
          <ProductThumb
            src={imageUrl}
            title={title}
            category={categoryName}
            decorative
            className={cn(
              "aspect-[4/5] w-full transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-[1.03]",
              outOfStock && "opacity-60",
            )}
          />
          {outOfStock && (
            <Badge className="absolute left-2 top-2 bg-paper">Out of stock</Badge>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Heading className="line-clamp-2 text-sm font-medium leading-5 tracking-normal sm:text-base sm:leading-6">{title}</Heading>
          <Price min={priceMin} max={priceMax} original={originalPrice} size="sm" className="sm:text-base" />
          <Rating value={rating} count={ratingCount} />
          {shopName && (
            <p className="flex items-center gap-1 text-xs text-muted">
              <span className="truncate">{shopName}</span>
              {shopVerified && (
                <span className="inline-flex shrink-0 items-center gap-0.5 text-jade">
                  <BadgeCheck aria-hidden="true" size={14} />
                  <span className="sr-only">Verified shop</span>
                </span>
              )}
            </p>
          )}
        </div>
      </Link>
      {action && <div>{action}</div>}
    </div>
  );
}

/** Loading placeholder with the same footprint as ProductCard, so nothing shifts when data arrives. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      <Skeleton className="aspect-[4/5] w-full rounded-md" />
      <Skeleton className="h-4 w-11/12" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/**
 * The responsive product grid: 2 columns on phones, 3 from sm, 4 from lg, 5 from xl. Children are
 * <ProductCard>s; each is wrapped in an <li>. `label` names the list for screen readers.
 */
export function ProductGrid({ label, children, className }: { label: string; children: ReactNode[]; className?: string }) {
  return (
    <ul
      aria-label={label}
      className={cn("grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5", className)}
    >
      {children.map((child, i) => (
        <li key={i}>{child}</li>
      ))}
    </ul>
  );
}

/** A grid of skeletons for a Suspense fallback. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div role="status" className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-8 lg:grid-cols-4 xl:grid-cols-5">
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
