import { CopyLinkButton } from "@/components/copy-link-button";
import type { ShopStatus } from "@/generated/prisma/client";
import { facebookShareUrl, storefrontUrl } from "@/lib/storefront-link";

/**
 * US-014: the shop's storefront link with copy and Facebook share, for the owner and staff on
 * the seller dashboard. The storefront is public only while the shop is approved.
 */
export function ShareStorefront({ slug, status }: { slug: string; status: ShopStatus }) {
  const url = storefrontUrl(slug);
  return (
    <section aria-labelledby="storefront-link" className="flex flex-col gap-2 rounded border border-gray-300 p-4">
      <h2 id="storefront-link" className="text-xl font-semibold">
        Storefront link
      </h2>
      {status === "approved" ? (
        <>
          <p>Share your shop&apos;s page with your Facebook followers and customers.</p>
          <p className="flex flex-wrap items-center gap-3">
            <a className="break-all text-blue-800 underline" href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
            <CopyLinkButton value={url} />
          </p>
          <p>
            <a className="text-blue-800 underline" href={facebookShareUrl(url)} target="_blank" rel="noreferrer">
              Share on Facebook
            </a>
          </p>
        </>
      ) : (
        <p>
          Your storefront will be at <span className="break-all font-mono">{url}</span>. It goes live while the shop is
          approved.
        </p>
      )}
    </section>
  );
}
