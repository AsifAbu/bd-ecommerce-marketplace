import { Heart } from "lucide-react";
import Link from "next/link";
import { buttonStyles, EmptyState, Notice, ProductCard, ProductGrid, TextLink } from "@/components/ui";
import type { WishlistItemView } from "../service";
import { MoveToCartButton } from "./move-to-cart-button";
import { RemoveButton } from "./remove-button";

/**
 * /account/wishlist (US-057): saved items with price and stock, remove, and move to cart.
 * `moved` shows the confirmation after an item was moved to the cart.
 */
export function WishlistList({ items, moved = false }: { items: WishlistItemView[]; moved?: boolean }) {
  const notice = moved && (
    <Notice tone="success">
      Moved to your cart. <TextLink href="/cart">View cart</TextLink>
    </Notice>
  );
  if (items.length === 0) {
    return (
      <>
        {notice}
        <EmptyState
          icon={<Heart aria-hidden="true" size={24} />}
          title="Your wishlist is empty"
          description="Choose Save to wishlist on a product to keep it here for later."
          action={
            <Link href="/" className={buttonStyles()}>
              Start browsing
            </Link>
          }
        />
      </>
    );
  }
  return (
    <>
      {notice}
      <ProductGrid label="Wishlist items" className="lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <Item key={item.id} item={item} />
        ))}
      </ProductGrid>
    </>
  );
}

/** "Tk 1,850" or "Tk 1,850 – 1,950" back into numbers for the card's price. */
function pricesOf(text: string): [number, number] {
  const nums = (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => Number(n.replace(/,/g, "")));
  return [nums[0] ?? 0, nums[nums.length - 1] ?? nums[0] ?? 0];
}

function Item({ item }: { item: WishlistItemView }) {
  const hintId = `move-hint-${item.id}`;
  const hint = item.moveHint && item.moveHint !== "Out of stock" ? item.moveHint : null; // the badge already says it
  const [min, max] = pricesOf(item.priceText);
  return (
    <ProductCard
      headingLevel={2}
      href={item.href}
      title={item.title}
      imageUrl={item.imageId ? `/api/product-images/${item.imageId}` : null}
      priceMin={min}
      priceMax={max}
      shopName={item.shopName}
      outOfStock={item.status === "out_of_stock"}
      action={
        <div className="flex flex-col gap-2">
          {item.variantLabel && <p className="text-sm text-muted">{item.variantLabel}</p>}
          <p className="sr-only">{item.statusLabel}</p>
          {item.canMoveToCart ? (
            <MoveToCartButton itemId={item.id} title={item.title} />
          ) : (
            <>
              <button
                type="button"
                disabled
                aria-label={`Move to cart: ${item.title}`}
                aria-describedby={hint ? hintId : undefined}
                className={buttonStyles({ block: true })}
              >
                Move to cart
              </button>
              {hint && (
                <span id={hintId} className="text-xs text-muted">
                  {hint}
                </span>
              )}
            </>
          )}
          <RemoveButton itemId={item.id} title={item.title} />
        </div>
      }
    />
  );
}
