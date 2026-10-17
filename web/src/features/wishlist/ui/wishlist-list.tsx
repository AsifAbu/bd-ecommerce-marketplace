import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import type { WishlistItemView } from "../service";
import { RemoveButton } from "./remove-button";

/** /account/wishlist (US-057): saved items with price and stock, remove, and move to cart (Sprint 6). */
export function WishlistList({ items }: { items: WishlistItemView[] }) {
  if (items.length === 0) {
    return (
      <p>
        Your wishlist is empty. Tap <span aria-hidden="true">♡</span> <strong>Save to wishlist</strong> on a product to keep it here.{" "}
        <Link className="text-blue-800 underline" href="/">
          Start browsing
        </Link>
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-4" aria-label="Wishlist items">
      {items.map((item) => {
        const hintId = `move-hint-${item.id}`;
        return (
          <li key={item.id} className="flex flex-wrap gap-4 rounded border border-gray-300 p-3">
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
              <button
                type="button"
                disabled
                aria-describedby={hintId}
                className="rounded bg-blue-700 px-3 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Move to cart
              </button>
              <span id={hintId} className="text-xs text-gray-700">
                {item.moveHint && item.moveHint !== "Out of stock" ? `${item.moveHint}. ` : ""}Cart coming soon
              </span>
              <RemoveButton itemId={item.id} title={item.title} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
