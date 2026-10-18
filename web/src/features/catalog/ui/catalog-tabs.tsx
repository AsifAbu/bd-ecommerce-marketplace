import { FilterChips } from "@/components/ui";

/** Switch between the two catalog admin views. Category requests live under Review in the admin navigation. */
export function CatalogTabs({ current }: { current: "tree" | "attributes" }) {
  return (
    <FilterChips
      label="Catalog admin"
      items={[
        { label: "Category tree", href: "/admin/catalog", current: current === "tree" },
        { label: "Attributes", href: "/admin/catalog/attributes", current: current === "attributes" },
      ]}
    />
  );
}
