import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { LogoutButton } from "@/features/accounts/ui/page-shell";
import { getHomeData } from "@/features/home/server";
import { DemoHint } from "@/features/home/ui/demo-hint";
import { Hero, HomeSections, SellCta } from "@/features/home/ui/home-view";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-6">
      <Hero>
        <Suspense fallback={<p>Checking session…</p>}>
          <SessionStatus />
        </Suspense>
      </Hero>
      <Suspense fallback={null}>
        <DemoHint />
      </Suspense>
      <Suspense fallback={<p aria-live="polite">Loading products…</p>}>
        <Sections />
      </Suspense>
      <SellCta />
    </main>
  );
}

async function Sections() {
  await connection(); // products and counts change at request time
  return <HomeSections data={await getHomeData()} />;
}

async function SessionStatus() {
  await connection(); // session reads are request-time (Cache Components)
  const session = await auth();
  const link = "font-medium underline";
  if (!session?.user) {
    return (
      <p>
        <Link className={link} href="/login">
          Log in
        </Link>{" "}
        with your mobile number or email, or{" "}
        <Link className={link} href="/signup">
          create an account
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4">
      <span>Logged in as {session.user.name ?? session.user.email}.</span>
      <Link className={link} href="/account">
        My account
      </Link>
      <LogoutButton />
    </div>
  );
}
