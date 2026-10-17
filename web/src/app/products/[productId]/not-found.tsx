import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold">Product not available</h1>
      <p>This product doesn&apos;t exist or is no longer sold.</p>
      <p>
        <Link className="text-blue-800 underline" href="/">
          Back to the marketplace
        </Link>
      </p>
    </div>
  );
}
