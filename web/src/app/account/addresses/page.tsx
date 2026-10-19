import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { AddressesPage } from "@/features/accounts/ui/account-pages";
import { ListSkeleton } from "@/features/accounts/ui/auth-shell";

export const metadata = { title: "My addresses" };

export default function Page({ searchParams }: PageProps<"/account/addresses">) {
  return (
    <>
      <PageHeader title="My addresses" />
      <Suspense fallback={<ListSkeleton />}>
        <AddressesPage searchParams={searchParams} />
      </Suspense>
    </>
  );
}
