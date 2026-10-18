"use client";

import { useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { ProductImage } from "@/components/product-image";
import { cn } from "@/components/ui";

/**
 * Product page images: one large picture that crossfades, thumbnails below (they scroll sideways
 * on phones), swipe on touch screens and the arrow keys when the picture has focus. Only the
 * picture on screen and the next one are loaded, so a phone on mobile data does not pull them all.
 */
export function ProductGallery({ title, images }: { title: string; images: { id: string; alt: string }[] }) {
  const count = images.length;
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set([0, 1]));
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function go(to: number) {
    if (count < 2) return;
    const next = (to + count) % count;
    setIndex(next);
    setLoaded((s) => new Set(s).add(next).add((next + 1) % count));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(index - 1);
    }
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    const end = e.changedTouches[0];
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? index + 1 : index - 1);
  }

  const multiple = count > 1;
  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-square overflow-hidden rounded-lg bg-surface [touch-action:pan-y]"
        {...(multiple
          ? {
              role: "group",
              "aria-roledescription": "carousel",
              "aria-label": `Pictures of ${title}`,
              tabIndex: 0,
              onKeyDown,
              onTouchStart: (e: TouchEvent) => {
                touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
              },
              onTouchEnd,
            }
          : {})}
      >
        {count === 0 && <ProductImage imageId={null} alt={title} className="absolute inset-0 h-full w-full" />}
        {images.map((img, i) =>
          i === index || loaded.has(i) ? (
            <div
              key={img.id}
              aria-hidden={i === index ? undefined : true}
              className={cn(
                "absolute inset-0 transition-opacity duration-[var(--duration-slow)] ease-[var(--ease-out)]",
                i === index ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <ProductImage imageId={img.id} alt={img.alt || title} className="h-full w-full" />
            </div>
          ) : null,
        )}
        {multiple && (
          <>
            <p aria-hidden="true" className="tabular absolute bottom-3 right-3 rounded-sm bg-paper/90 px-2 py-0.5 text-xs text-ink">
              {index + 1} / {count}
            </p>
            <p className="sr-only" aria-live="polite">
              Picture {index + 1} of {count}
            </p>
          </>
        )}
      </div>
      {multiple && (
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Product images">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Show image ${i + 1} of ${count}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "pressable block size-16 overflow-hidden rounded-md border-2 bg-surface",
                  i === index ? "border-jade" : "border-transparent hover:border-edge",
                )}
              >
                <ProductImage imageId={img.id} alt="" fit="cover" loading="lazy" className="h-full w-full" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
