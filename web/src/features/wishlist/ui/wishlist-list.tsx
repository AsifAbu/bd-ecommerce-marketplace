import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import type { WishlistItemView } from "../service";
import { MoveToCartButton } from "./move-to-cart-button";
import { RemoveButton } from "./remove-button";

/**
 * /account/wishlist (US-057): saved items with price and stock, remove, and move to cart.
 * `moved` shows the confirmation after an item was moved to the cart.
 */
export function WishlistList({ items, moved = false }: { items: WishlistItemView[]; moved?: boolean }) {
  const notice = moved && (
    <p role="status" className="rounded border border-green-700 bg-green-50 px-3 py-2 text-green-900">
      Moved to your cart.{" "}
      <Link className="underline" href="/cart">
        View cart
      </Link>
    </p>
  );
  if (items.length === 0) {
    return (
      <>
        {notice}
        <EmptyWishlist />
      </>
    );
  }
  return (
    <>
      {notice}
      <ul className="flex flex-col gap-4" aria-label="Wishlist items">
        {items.map((item) => (
          <Item key={item.id} item={item} />
        ))}
      </ul>
    </>
  );
}

function EmptyWishlist() {
  return (
    <p>
      Your wishlist is empty. Tap <span aria-hidden="true">♡</span> <strong>Save to wishlist</strong> on a product to keep it here.{" "}
      <Link className="text-blue-800 underline" href="/">
        Start browsing
      </Link>
    </p>
  );
}

function Item({ item }: { item: WishlistItemView }) {
  const hintId = `move-hint-${item.id}`;
  const hint = item.moveHint && item.moveHint !== "Out of stock" ? item.moveHint : null; // the status already says it
  return (
    <li className="flex flex-wrap gap-4 rounded border border-gray-300 p-3">
      <ProductImage imageId={item.imageId} alt="" className="h-24 w-24 shrink-0 rounded" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link className="font-semibold text-blue-800 underline" href={item.href}>
          {item.title}
        </Link>
        <p className="text-sm text-gray-700">{item.shopName}</p>
        {item.variantLabel && <p className="text-sm">{item.variantLabel}</p>}
        <p className="font-semibold">{item.priceText}</p>
        <p className={item.status === "in_stock" ? "text-sm text-green-800" : "text-sm font-semibold text-red-800"}>
          {item.statusLabel}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2">
        {item.canMoveToCart ? (
          <MoveToCartButton itemId={item.id} title={item.title} />
        ) : (
          <>
            <button
              type="button"
              disabled
              aria-label={`Move to cart: ${item.title}`}
              aria-describedby={hint ? hintId : undefined}
              className="rounded bg-blue-700 px-3 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Move to cart
            </button>
            {hint && (
              <span id={hintId} className="text-xs text-gray-700">
                {hint}
              </span>
            )}
          </>
        )}
        <RemoveButton itemId={item.id} title={item.title} />
      </div>
    </li>
  );
}
