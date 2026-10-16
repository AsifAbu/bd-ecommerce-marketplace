import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { LogoutButton } from "@/features/accounts/ui/page-shell";

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
        <Link className="underline" href="/login">
          Log in
        </Link>{" "}
        with your mobile number or email, or{" "}
        <Link className="underline" href="/signup">
          create an account
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-x-4 text-sm">
      <span>Logged in as {session.user.name ?? session.user.email}.</span>
      <Link className="underline" href="/account">
        My account
      </Link>
      <LogoutButton />
    </div>
  );
}
