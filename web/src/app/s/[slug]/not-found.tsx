import Link from "next/link";

export default function ShopNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-2 px-4 py-8">
      <h1 className="text-2xl font-bold">Shop not found</h1>
      <p>This shop doesn&apos;t exist or isn&apos;t open right now.</p>
      <p>
        <Link className="text-blue-800 underline" href="/">
          Go to the home page
        </Link>
      </p>
    </main>
  );
}
