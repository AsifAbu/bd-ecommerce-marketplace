import Link from "next/link";

export default function CatalogAdminLayout({ children }: LayoutProps<"/admin/catalog">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Catalog admin</h1>
      <nav aria-label="Catalog admin">
        <ul className="flex gap-4 text-sm">
          <li>
            <Link className="underline" href="/admin/catalog">
              Category tree
            </Link>
          </li>
          <li>
            <Link className="underline" href="/admin/catalog/attributes">
              Attributes
            </Link>
          </li>
          <li>
            <Link className="underline" href="/admin/catalog/requests">
              Requests
            </Link>
          </li>
        </ul>
      </nav>
      {children}
    </main>
  );
}
