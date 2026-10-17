"use client";

import { useState } from "react";

/** A product's cover image, or a placeholder when there is none or it fails to load (e.g. storage down). */
export function ProductCover({ imageId, title }: { imageId: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageId || failed) {
    return (
      <div
        role="img"
        aria-label={`No image for ${title}`}
        className="flex aspect-square w-full items-center justify-center rounded bg-gray-100 text-sm text-gray-600"
      >
        No image
      </div>
    );
  }
  return (
    // Signed-URL redirect from our own route; next/image can't optimise it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/product-images/${imageId}`}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-square w-full rounded bg-gray-100 object-cover"
    />
  );
}
