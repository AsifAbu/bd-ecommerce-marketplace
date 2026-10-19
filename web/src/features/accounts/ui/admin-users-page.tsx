import { StatusBadge } from "@/components/admin/status";
import { Button, EmptyState, FormField, Input, Notice } from "@/components/ui";
import { Table, Tbody, Td, Th, Thead, Tr } from "@/components/admin/data-table";
import { adminUserAction } from "../actions";
import { adminOrLogin } from "../page-guards";
import { adminUsers } from "../services";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** +8801XXXXXXXXX -> 01XXXXXXXXX for display. */
const localPhone = (phone: string | null) => (phone ? phone.replace(/^\+88/, "") : "");

const actionButtons = [
  { action: "suspend", label: "Suspend", danger: true, show: (u: { status: string }) => u.status === "active" },
  { action: "reactivate", label: "Reactivate", danger: false, show: (u: { status: string }) => u.status === "suspended" },
  { action: "grantAdmin", label: "Make Platform Admin", danger: false, show: (u: { isPlatformAdmin: boolean }) => !u.isPlatformAdmin },
  { action: "revokeAdmin", label: "Remove Platform Admin", danger: false, show: (u: { isPlatformAdmin: boolean }) => u.isPlatformAdmin },
] as const;

/** /admin/users: search and the account actions (suspend, reactivate, grant or remove Platform Admin). */
export async function AdminUsersContent({ searchParams }: { searchParams: SearchParams }) {
  const admin = await adminOrLogin("/admin/users");
  if (!admin) {
    return (
      <Notice tone="error">
        Not allowed. This page is for Platform Admins only.
      </Notice>
    );
  }
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw : "";
  const users = await adminUsers.list(q);

  return (
    <div className="flex flex-col gap-5">
      <form role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField label="Search by name, email or mobile" className="sm:w-96">
          {(p) => <Input name="q" type="search" defaultValue={q} {...p} />}
        </FormField>
        <Button type="submit">Search</Button>
      </form>
      <p className="text-sm text-muted">{q ? `Users matching “${q}”` : "Newest users"}, up to 50.</p>
      {users.length === 0 ? (
        <EmptyState title="No users found" description="Check the spelling, or search by the start of the email or mobile number." />
      ) : (
        <Table caption="Users (newest first, up to 50)" stack>
          <Thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Mobile</Th>
              <Th>Status</Th>
              <Th>Role</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {users.map((u) => (
              <Tr key={u.id}>
                <Td label="Name" className="font-medium">
                  {u.name ?? "—"}
                </Td>
                <Td label="Email" className="break-all">
                  {u.email ?? "—"}
                </Td>
                <Td label="Mobile" className="tabular">
                  {localPhone(u.phone) || "—"}
                </Td>
                <Td label="Status">
                  <StatusBadge status={u.status === "active" ? "active" : "suspended"}>{u.status === "active" ? "Active" : "Suspended"}</StatusBadge>
                </Td>
                <Td label="Role">{u.isPlatformAdmin ? "Platform Admin" : "User"}</Td>
                <Td label="Actions">
                  {u.id === admin.id ? (
                    <span className="text-muted">You</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {actionButtons
                        .filter((b) => b.show(u))
                        .map((b) => (
                          <form key={b.action} action={adminUserAction}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="action" value={b.action} />
                            <Button type="submit" variant={b.danger ? "danger" : "secondary"} className="sm:min-h-9 sm:px-3 sm:text-sm">
                              {b.label}
                              <span className="sr-only"> {u.name ?? u.email ?? u.phone}</span>
                            </Button>
                          </form>
                        ))}
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  );
}
