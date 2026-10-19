import Link from "next/link";
import { buttonStyles, PageMain } from "@/components/ui";

export default function ProductNotFound() {
  return (
    <PageMain>
      <div className="flex flex-col items-start gap-3 rounded-lg bg-surface p-6 sm:p-8">
        <h1 className="text-2xl">Product not available</h1>
        <p className="max-w-prose text-muted">This product doesn&apos;t exist or is no longer sold.</p>
        <Link href="/" className={buttonStyles({ variant: "secondary" })}>
          Back to the marketplace
        </Link>
      </div>
    </PageMain>
  );
}
