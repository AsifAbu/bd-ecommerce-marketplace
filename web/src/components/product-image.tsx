"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A product image served by /api/product-images/[id] (302 to a signed URL). Shows a neutral
 * placeholder when there is no image or it fails to load (e.g. storage is down: 503).
 */
export function ProductImage({ imageId, alt, className = "" }: { imageId: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // The image may have failed before hydration attached onError.
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [imageId]);

  if (!imageId || failed) {
    // Decorative uses (alt="") stay hidden from screen readers.
    const label = alt ? { role: "img", "aria-label": `${alt} (no image available)` } : { "aria-hidden": true };
    return (
      <div {...label} className={`flex items-center justify-center bg-surface text-sm text-muted ${className}`}>
        <span aria-hidden="true">No image</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={`/api/product-images/${encodeURIComponent(imageId)}`}
      alt={alt}
      onError={() => setFailed(true)}
      className={`bg-surface object-contain ${className}`}
    />
  );
}
