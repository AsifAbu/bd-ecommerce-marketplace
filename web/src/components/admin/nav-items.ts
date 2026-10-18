export interface AdminNavItem {
  label: string;
  href: string;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** The admin area, grouped by the kind of work. The labels are the page titles' short forms. */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Review",
    items: [
      { label: "Shops", href: "/admin/shops" },
      { label: "Category requests", href: "/admin/catalog/requests" },
      { label: "Reviews", href: "/admin/reviews" },
      { label: "Returns", href: "/admin/returns" },
      { label: "Complaints", href: "/admin/complaints" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { label: "Orders", href: "/admin/orders" },
      { label: "Payouts", href: "/admin/payouts" },
      { label: "Metrics", href: "/admin/metrics" },
    ],
  },
  { label: "Catalog", items: [{ label: "Categories and attributes", href: "/admin/catalog" }] },
  { label: "People", items: [{ label: "Users", href: "/admin/users" }] },
  {
    label: "Compliance",
    items: [
      { label: "Policies", href: "/admin/policies" },
      { label: "Compliance", href: "/admin/compliance" },
    ],
  },
];
