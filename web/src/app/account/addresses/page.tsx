import { Suspense } from "react";
import { AddressesPage } from "@/features/accounts/ui/account-pages";
import { Loading, PageShell } from "@/features/accounts/ui/page-shell";

export const metadata = { title: "My addresses" };

export default function Page({ searchParams }: PageProps<"/account/addresses">) {
  return (
    <PageShell title="My addresses">
      <Suspense fallback={<Loading />}>
        <AddressesPage searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}
