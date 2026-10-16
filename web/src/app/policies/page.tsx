import { PolicyIndex } from "@/features/policies/ui/public-policy";

export const metadata = { title: "Policies" };

export default function PoliciesPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold">Policies</h1>
      <PolicyIndex />
    </main>
  );
}
