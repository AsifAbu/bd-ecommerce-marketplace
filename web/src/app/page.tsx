import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-16">
      <h1 className="text-3xl font-bold">Marketplace</h1>
      <p className="text-lg">All online products in one place, from shops across Bangladesh.</p>
      <Suspense fallback={<p className="text-sm">Checking session…</p>}>
        <SessionStatus />
      </Suspense>
    </main>
  );
}

async function SessionStatus() {
  await connection(); // session reads are request-time (Cache Components)
  const session = await auth();
  if (!session?.user) {
    return (
      <p className="text-sm">
        <Link className="underline" href="/api/auth/signin">
          Log in
        </Link>{" "}
        with your mobile number or email.
      </p>
    );
  }
  return (
    <p className="text-sm">
      Logged in as {session.user.name ?? session.user.email}.{" "}
      <Link className="underline" href="/api/auth/signout">
        Log out
      </Link>
    </p>
  );
}
