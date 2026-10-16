"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Removes one wishlist item through the JSON API, then refreshes the list. */
export function RemoveButton({ itemId, title }: { itemId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/wishlist/${encodeURIComponent(itemId)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error();
      router.refresh();
    } catch {
      setError("Could not remove the item. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        aria-label={`Remove ${title} from wishlist`}
        className="rounded border border-red-700 px-3 py-1 font-medium text-red-800 hover:bg-red-50 focus:outline-2 focus:outline-offset-2 focus:outline-red-700 disabled:opacity-60"
      >
        Remove
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  );
}
