import { connection } from "next/server";
import { Suspense } from "react";
import { Container, PageHeader } from "@/components/ui";
import { FormSkeleton } from "@/features/accounts/ui/auth-shell";
import { ApplyForm } from "@/features/shops/components/apply-form";
import { guardPage } from "@/features/shops/page-guard";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Open a shop" };

export default function ApplyPage() {
  return (
    <Container as="main" className="flex max-w-2xl flex-1 flex-col gap-8 py-6 sm:py-10">
      <PageHeader
        title="Open a shop"
        description="You start as a Basic seller, with up to 20 open orders and 100 live listings. You can upgrade to Verified later with a trade licence, VAT, TIN, UBID, PRA or DBID registration. Your shop goes live after admin approval."
      />
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <Gate />
      </Suspense>
    </Container>
  );
}

async function Gate() {
  await connection();
  await guardPage("/shops/apply", requireUser);
  return <ApplyForm />;
}
