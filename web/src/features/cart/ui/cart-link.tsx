import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { cache } from "react";
import { connection } from "next/server";
import { cartService, resolveCartOwner } from "../server";

/** Item count of the current cart (guests and logged-in customers). Cached per request: the header and tab bar share one query. */
const cartCount = cache(async () => {
  await connection(); // cookies and session are request-time (Cache Components)
  const owner = await resolveCartOwner({ writable: false, merge: false });
  return owner ? await cartService.countItems(owner) : 0;
});

/** Header link to the cart with the number of items. Text stays "Cart (N item[s])" for screen readers and tests. */
export async function CartLink() {
  const count = await cartCount();
  return (
    <Link
      className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-surface"
      href="/cart"
    >
      <ShoppingBag aria-hidden="true" size={18} />
      <span>
        Cart (<span key={count} className="tabular count-bump">{count}</span>
        <span className="sr-only"> {count === 1 ? "item" : "items"}</span>)
      </span>
    </Link>
  );
}

/** Small count bubble on the Cart tab of the phone tab bar. Renders nothing for an empty cart. */
export async function CartTabBadge() {
  const count = await cartCount();
  if (count === 0) return null;
  return (
    <span key={count} className="count-bump tabular absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-jade px-1 text-center text-[0.6875rem] font-semibold leading-4 text-paper">
      {count > 99 ? "99+" : count}
      <span className="sr-only"> {count === 1 ? "item in cart" : "items in cart"}</span>
    </span>
  );
}
