"use client";

import { useEffect, useRef, useState } from "react";
import { initialOf, toneFor } from "./product-thumb-style";

/**
 * A square product picture. With no image, or when the image fails to load (storage down: 503),
 * shows a coloured tile with the product's initial and category name instead of a broken image.
 */
export function ProductThumb({
  src,
  title,
  category,
  decorative = false,
  className = "",
}: {
  src: string | null;
  title: string;
  category?: string;
  /** The title is printed next to the picture, so screen readers can skip it. */
  decorative?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // The image may have failed before hydration attached onError.
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);

  if (!src || failed) {
    const a11y = decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `${title} (no picture yet)` };
    return (
      <div
        data-testid="product-placeholder"
        {...a11y}
        className={`flex flex-col items-center justify-center gap-1 ${toneFor(category ?? title)} ${className}`}
      >
        <span aria-hidden="true" className="text-5xl font-bold leading-none">
          {initialOf(title)}
        </span>
        {category && (
          <span aria-hidden="true" className="max-w-[90%] truncate text-xs font-medium opacity-80">
            {category}
          </span>
        )}
      </div>
    );
  }
  return (
    // Signed-URL redirect from our own route; next/image can't optimise it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={decorative ? "" : title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`bg-gray-100 object-cover ${className}`}
    />
  );
}
