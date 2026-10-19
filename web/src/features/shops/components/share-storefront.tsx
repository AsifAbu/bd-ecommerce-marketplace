import { CopyLinkButton } from "@/components/copy-link-button";
import { Section, linkStyles } from "@/components/ui";
import type { ShopStatus } from "@/generated/prisma/client";
import { facebookShareUrl, storefrontUrl } from "@/lib/storefront-link";

/**
 * US-014: the shop's storefront link with copy and Facebook share, for the owner and staff on
 * the seller dashboard. The storefront is public only while the shop is approved.
 */
export function ShareStorefront({ slug, status }: { slug: string; status: ShopStatus }) {
  const url = storefrontUrl(slug);
  return (
    <Section title="Storefront link" id="storefront-link" className="max-w-2xl">
      {status === "approved" ? (
        <>
          <p className="text-muted">Share your shop&apos;s page with your Facebook followers and customers.</p>
          <p>
            <a className={`${linkStyles} break-all`} href={url} target="_blank" rel="noreferrer">
              {url}
            </a>
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <CopyLinkButton value={url} />
            <a className={`${linkStyles} inline-flex min-h-11 items-center font-medium`} href={facebookShareUrl(url)} target="_blank" rel="noreferrer">
              Share on Facebook
            </a>
          </div>
        </>
      ) : (
        <p className="text-muted">
          Your storefront will be at <span className="break-all font-mono text-sm text-ink">{url}</span>. It goes live while the shop is
          approved.
        </p>
      )}
    </Section>
  );
}
