import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "../actions";

export function PageShell({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <main className={`mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-10 ${wide ? "max-w-5xl" : "max-w-md"}`}>
      <p className="text-sm">
        <Link className="underline" href="/">
          Marketplace home
        </Link>
      </p>
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="min-h-11 text-left font-medium text-jade hover:underline">
        Log out
      </button>
    </form>
  );
}

export const Loading = () => <p role="status">Loading…</p>;
