"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { callApi } from "./api-client";
import { buttonClass, dangerButtonClass, errorTextClass, inputClass, secondaryButtonClass } from "./styles";

const MAX_IMAGES = 8;

/** Product images (US-032): upload (JPEG, PNG or WebP, 5 MB), make cover, delete. The first image is the cover. */
export function ImageManager({ shopId, productId, images }: { shopId: string; productId: string; images: { id: string }[] }) {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/shops/${shopId}/products/${productId}/images`;

  async function run(call: Promise<Awaited<ReturnType<typeof callApi>>>, after?: () => void) {
    setPending(true);
    setError(null);
    const result = await call;
    setPending(false);
    if (!result.ok) return setError(result.error.fields?.file ?? result.error.message);
    after?.();
    router.refresh();
  }

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    await run(callApi(base, { method: "POST", body: new FormData(form) }), () => form.reset());
  }

  return (
    <div className="flex flex-col gap-3">
      {images.length === 0 ? (
        <p>No images yet. The first image you upload is the cover.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((img, i) => (
            <li key={img.id} className="flex flex-col gap-2 rounded border border-gray-300 p-2">
              {/* Signed private-bucket URLs: not for the Next image optimiser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/product-images/${img.id}`}
                alt={i === 0 ? "Cover image" : `Image ${i + 1}`}
                className="aspect-square w-full bg-gray-100 object-cover"
              />
              <span className="text-sm">{i === 0 ? "Cover" : `Image ${i + 1}`}</span>
              <div className="flex flex-wrap gap-1">
                {i > 0 && (
                  <button
                    type="button"
                    disabled={pending}
                    className={secondaryButtonClass}
                    onClick={() => run(callApi(`${base}/${img.id}`, { method: "PATCH", json: { cover: true } }))}
                  >
                    Make cover
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  className={dangerButtonClass}
                  aria-label={`Delete ${i === 0 ? "cover image" : `image ${i + 1}`}`}
                  onClick={() => run(callApi(`${base}/${img.id}`, { method: "DELETE" }))}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {images.length < MAX_IMAGES ? (
        <form onSubmit={onUpload} className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={id} className="font-medium">
              Add an image
            </label>
            <p id={`${id}-hint`} className="text-sm text-gray-700">
              JPEG, PNG or WebP, up to 5 MB. Up to {MAX_IMAGES} images.
            </p>
            <input
              id={id}
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              className={inputClass}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
              aria-invalid={error ? true : undefined}
            />
          </div>
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Please wait…" : "Upload image"}
          </button>
        </form>
      ) : (
        <p>This product has the maximum of {MAX_IMAGES} images.</p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className={errorTextClass}>
          {error}
        </p>
      )}
    </div>
  );
}
