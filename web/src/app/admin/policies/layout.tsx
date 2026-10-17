import Link from "next/link";

export default function PoliciesAdminLayout({ children }: LayoutProps<"/admin/policies">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-3xl font-bold">Policies admin</h1>
      <nav aria-label="Compliance admin">
        <ul className="flex gap-4 text-sm">
          <li>
            <Link className="underline" href="/admin/policies">
              All policies
            </Link>
          </li>
          <li>
            <Link className="underline" href="/admin/compliance">
              DBID and record retention
            </Link>
          </li>
        </ul>
      </nav>
      {children}
    </main>
  );
}
