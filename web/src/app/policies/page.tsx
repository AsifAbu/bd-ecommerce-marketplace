import { PageMain } from "@/components/ui";
import { PolicyIndex } from "@/features/policies/ui/public-policy";

export const metadata = { title: "Policies" };

export default function PoliciesPage() {
  return (
    <PageMain className="gap-8">
      <header className="flex max-w-[70ch] flex-col gap-2">
        <h1 className="text-3xl font-semibold sm:text-4xl">Policies</h1>
        <p className="text-muted">The rules for buying and selling on the marketplace. Each one shows the version in force and the earlier versions.</p>
      </header>
      <PolicyIndex />
    </PageMain>
  );
}
