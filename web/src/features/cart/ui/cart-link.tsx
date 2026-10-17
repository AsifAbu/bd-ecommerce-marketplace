import Link from "next/link";
import { connection } from "next/server";
import { cartService, resolveCartOwner } from "../server";

/** Header link to the cart with the number of items (guests and logged-in customers). */
export async function CartLink() {
  await connection(); // cookies and session are request-time (Cache Components)
  const owner = await resolveCartOwner({ writable: false, merge: false });
  const count = owner ? await cartService.countItems(owner) : 0;
  return (
    <Link className="underline" href="/cart">
      Cart ({count}
      <span className="sr-only"> {count === 1 ? "item" : "items"}</span>)
    </Link>
  );
}
