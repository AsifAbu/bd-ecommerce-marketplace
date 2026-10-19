import { connection } from "next/server";
import { auth } from "@/auth";
import { adminWaiting, loadMenuData } from "@/lib/menu-data";
import { AdminNavLinks } from "./nav-links";

/**
 * The admin section navigation with the number of waiting shop items. Display only: it shows
 * itself to a Platform Admin and renders nothing for anyone else. Access to every page is still
 * decided by that page's own guard (requirePlatformAdmin), not by this component.
 */
export async function AdminNav() {
  await connection(); // session reads are request-time (Cache Components)
  const userId = (await auth())?.user?.id;
  if (!userId) return null;
  let waiting = 0;
  try {
    const menu = await loadMenuData(userId);
    if (!menu?.isPlatformAdmin) return null;
    waiting = menu.admin ? adminWaiting(menu.admin) : 0;
  } catch {
    return null; // the navigation is a convenience; the page content does not depend on it
  }
  return <AdminNavLinks waiting={waiting} />;
}
