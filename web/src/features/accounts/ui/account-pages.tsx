import { Pencil } from "lucide-react";
import Link from "next/link";
import { Badge, buttonStyles, EmptyState, linkStyles, Notice, Section } from "@/components/ui";
import { prisma } from "@/lib/db";
import { adminUserAction, deleteAddressAction, setDefaultAddressAction } from "../actions";
import { adminOrLogin, userOrLogin } from "../page-guards";
import { addressRepo, adminUsers } from "../services";
import { ProfileForm, ResendEmailButton, VerifyPhoneForms } from "./account-forms";
import { AddressForm } from "./address-form";
import { LogoutButton } from "./page-shell";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const param = async (sp: SearchParams, key: string) => {
  const v = (await sp)[key];
  return typeof v === "string" ? v : "";
};

/** +8801XXXXXXXXX -> 01XXXXXXXXX for display and form fields. */
const localPhone = (phone: string | null) => (phone ? phone.replace(/^\+88/, "") : "");

const rowAction = "inline-flex min-h-11 items-center rounded-sm px-2 text-sm font-medium hover:underline underline-offset-4";

function VerifiedBadge({ ok }: { ok: boolean }) {
  return <Badge tone={ok ? "brand" : "warning"}>{ok ? "Verified" : "Not verified"}</Badge>;
}

export async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const { id } = await userOrLogin("/account");
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  const notice =
    (await param(searchParams, "phoneVerified")) === "1"
      ? "Your mobile number is verified."
      : (await param(searchParams, "emailVerified")) === "1"
        ? "Your email is verified."
        : null;

  return (
    <div className="flex max-w-xl flex-col gap-10">
      {notice && <Notice tone="success">{notice}</Notice>}
      <Section title="Verification">
        {!user.phone && !user.email && <p className="text-muted">Add a mobile number or an email below.</p>}
        {user.phone && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="flex flex-wrap items-center gap-2">
              Mobile {localPhone(user.phone)} <VerifiedBadge ok={!!user.phoneVerifiedAt} />
            </p>
            {!user.phoneVerifiedAt && (
              <Link className={`${linkStyles} inline-flex min-h-11 items-center text-sm font-medium`} href="/account/verify-phone">
                Verify now
              </Link>
            )}
          </div>
        )}
        {user.email && (
          <div className="flex flex-col gap-2">
            <p className="flex flex-wrap items-center gap-2 break-all">
              Email {user.email} <VerifiedBadge ok={!!user.emailVerifiedAt} />
            </p>
            {!user.emailVerifiedAt && <ResendEmailButton />}
          </div>
        )}
      </Section>

      <Section title="Profile">
        <ProfileForm
          defaults={{ name: user.name ?? "", phone: localPhone(user.phone), email: user.email ?? "", avatarUrl: user.avatarUrl ?? "" }}
        />
      </Section>

      <Section title="More">
        <ul className="flex flex-col">
          <li>
            <Link className={`${linkStyles} inline-flex min-h-11 items-center`} href="/account/policies">
              Policies you accepted
            </Link>
          </li>
          <li>
            <Link className={`${linkStyles} inline-flex min-h-11 items-center`} href="/seller">
              My shops
            </Link>
          </li>
          {user.isPlatformAdmin && (
            <>
              <li>
                <Link className={`${linkStyles} inline-flex min-h-11 items-center`} href="/admin/users">
                  Manage users
                </Link>
              </li>
              <li>
                <Link className={`${linkStyles} inline-flex min-h-11 items-center`} href="/admin/metrics">
                  Marketplace metrics
                </Link>
              </li>
              <li>
                <Link className={`${linkStyles} inline-flex min-h-11 items-center`} href="/admin/orders">
                  All shop orders
                </Link>
              </li>
              <li>
                <Link className={`${linkStyles} inline-flex min-h-11 items-center`} href="/admin/payouts">
                  Payouts
                </Link>
              </li>
            </>
          )}
          <li>
            <LogoutButton />
          </li>
        </ul>
      </Section>
    </div>
  );
}

export async function VerifyPhonePage() {
  const { id } = await userOrLogin("/account/verify-phone");
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { phone: true, phoneVerifiedAt: true } });
  if (!user.phone) {
    return (
      <EmptyState
        title="You have no mobile number yet"
        description="Add one to your profile, then come back to verify it."
        action={
          <Link className={buttonStyles()} href="/account">
            Add a number to my profile
          </Link>
        }
      />
    );
  }
  if (user.phoneVerifiedAt) {
    return (
      <div className="flex max-w-xl flex-col items-start gap-4">
        <Notice tone="success">Your mobile number {localPhone(user.phone)} is verified.</Notice>
        <Link className={buttonStyles({ variant: "secondary" })} href="/account">
          Back to my account
        </Link>
      </div>
    );
  }
  return (
    <div className="flex max-w-md flex-col gap-6">
      <p className="text-muted">
        We will send a 6-digit code to <strong className="text-ink">{localPhone(user.phone)}</strong>. You need a verified mobile number for cash
        on delivery.
      </p>
      <VerifyPhoneForms />
      <Link className={`${linkStyles} inline-flex min-h-11 items-center self-start`} href="/account">
        Back to my account
      </Link>
    </div>
  );
}

const emptyAddress = { name: "", phone: "", division: "", district: "", upazila: "", area: "", line1: "", isDefault: false };

export async function AddressesPage({ searchParams }: { searchParams: SearchParams }) {
  const { id: userId, name, phone } = await userOrLogin("/account/addresses");
  const addresses = await addressRepo.list(userId);
  const editId = await param(searchParams, "edit");
  const editing = editId ? addresses.find((a) => a.id === editId) : undefined;

  return (
    <div className="flex flex-col gap-10">
      <Section title="Saved addresses">
        {addresses.length === 0 ? (
          <p className="text-muted">No saved addresses yet. Add the first one below and checkout will use it.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {addresses.map((a) => (
              <li key={a.id} className={`flex flex-col gap-1 py-4 ${editing?.id === a.id ? "bg-jade-soft/50" : ""}`}>
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {a.name}, {localPhone(a.phone)}
                  {a.isDefault && <Badge tone="brand">Default</Badge>}
                </p>
                <p className="text-muted">
                  {a.line1}, {a.area}, {a.upazila}, {a.district}, {a.division}
                </p>
                <div className="-ml-2 flex flex-wrap items-center">
                  <Link className={`${rowAction} text-jade`} href={`/account/addresses?edit=${a.id}`}>
                    <Pencil aria-hidden="true" size={14} className="mr-1.5" />
                    Edit<span className="sr-only"> address for {a.name}</span>
                  </Link>
                  {!a.isDefault && (
                    <form action={setDefaultAddressAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className={`${rowAction} text-jade`} type="submit">
                        Make default
                      </button>
                    </form>
                  )}
                  <form action={deleteAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className={`${rowAction} text-vermilion`} type="submit">
                      Delete<span className="sr-only"> address for {a.name}</span>
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title={editing ? "Edit address" : "Add an address"} className="max-w-xl">
        <AddressForm
          key={editing?.id ?? "new"}
          defaults={
            editing
              ? { ...editing, phone: localPhone(editing.phone) }
              : { ...emptyAddress, name: name ?? "", phone: localPhone(phone) }
          }
        />
        {editing && (
          <Link className={`${linkStyles} inline-flex min-h-11 items-center self-start`} href="/account/addresses">
            Cancel editing
          </Link>
        )}
      </Section>
    </div>
  );
}

const actionButtons = [
  { action: "suspend", label: "Suspend", show: (u: { status: string }) => u.status === "active" },
  { action: "reactivate", label: "Reactivate", show: (u: { status: string }) => u.status === "suspended" },
  { action: "grantAdmin", label: "Make Platform Admin", show: (u: { isPlatformAdmin: boolean }) => !u.isPlatformAdmin },
  { action: "revokeAdmin", label: "Remove Platform Admin", show: (u: { isPlatformAdmin: boolean }) => u.isPlatformAdmin },
] as const;

export async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const admin = await adminOrLogin("/admin/users");
  if (!admin) return <p role="alert">Not allowed. This page is for Platform Admins only.</p>;
  const q = await param(searchParams, "q");
  const users = await adminUsers.list(q);

  return (
    <div className="flex flex-col gap-6">
      <form role="search" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="q" className="font-medium">
            Search by name, email or mobile
          </label>
          <input id="q" name="q" defaultValue={q} className="rounded border border-gray-400 px-3 py-2" />
        </div>
        <button type="submit" className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">
          Search
        </button>
      </form>
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Users (newest first, up to 50)</caption>
        <thead>
          <tr className="border-b border-gray-400">
            <th scope="col" className="py-2 pr-3">Name</th>
            <th scope="col" className="py-2 pr-3">Email</th>
            <th scope="col" className="py-2 pr-3">Mobile</th>
            <th scope="col" className="py-2 pr-3">Status</th>
            <th scope="col" className="py-2 pr-3">Role</th>
            <th scope="col" className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-gray-200 align-top">
              <td className="py-2 pr-3">{u.name ?? "—"}</td>
              <td className="py-2 pr-3">{u.email ?? "—"}</td>
              <td className="py-2 pr-3">{localPhone(u.phone) || "—"}</td>
              <td className="py-2 pr-3">{u.status === "active" ? "Active" : "Suspended"}</td>
              <td className="py-2 pr-3">{u.isPlatformAdmin ? "Platform Admin" : "User"}</td>
              <td className="py-2">
                {u.id === admin.id ? (
                  <span className="text-gray-700">You</span>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {actionButtons
                      .filter((b) => b.show(u))
                      .map((b) => (
                        <form key={b.action} action={adminUserAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="action" value={b.action} />
                          <button type="submit" className="underline">
                            {b.label}
                            <span className="sr-only"> {u.name ?? u.email ?? u.phone}</span>
                          </button>
                        </form>
                      ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {users.length === 0 && <p>No users found.</p>}
    </div>
  );
}
