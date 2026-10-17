"use client";

import { useState } from "react";
import { ProductImage } from "@/components/product-image";

/** Product page images: the cover first, thumbnails as buttons to switch the main image. */
export function ProductGallery({ title, images }: { title: string; images: { id: string; alt: string }[] }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <ProductImage
        key={current?.id ?? "none"}
        imageId={current?.id ?? null}
        alt={current?.alt ?? title}
        className="aspect-square w-full rounded border border-gray-300"
      />
      {images.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show image ${i + 1} of ${images.length}`}
                aria-current={i === index ? "true" : undefined}
                className={`block h-16 w-16 overflow-hidden rounded border-2 focus:outline-2 focus:outline-offset-2 focus:outline-blue-700 ${
                  i === index ? "border-blue-700" : "border-gray-300"
                }`}
              >
                <ProductImage imageId={img.id} alt="" className="h-full w-full" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
