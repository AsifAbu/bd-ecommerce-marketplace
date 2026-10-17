import Link from "next/link";
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

function Badge({ ok }: { ok: boolean }) {
  return (
    <span className={`ml-2 rounded px-2 py-0.5 text-sm ${ok ? "bg-green-100 text-green-900" : "bg-amber-100 text-amber-900"}`}>
      {ok ? "Verified" : "Not verified"}
    </span>
  );
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
    <div className="flex flex-col gap-8">
      {notice && (
        <p role="status" className="rounded border border-green-700 bg-green-50 px-3 py-2 text-green-900">
          {notice}
        </p>
      )}
      <section aria-labelledby="status-h" className="flex flex-col gap-3">
        <h2 id="status-h" className="text-lg font-semibold">
          Verification
        </h2>
        {user.phone && (
          <div>
            Mobile {localPhone(user.phone)} <Badge ok={!!user.phoneVerifiedAt} />
            {!user.phoneVerifiedAt && (
              <Link className="ml-3 underline" href="/account/verify-phone">
                Verify now
              </Link>
            )}
          </div>
        )}
        {user.email && (
          <div className="flex flex-col gap-2">
            <div>
              Email {user.email} <Badge ok={!!user.emailVerifiedAt} />
            </div>
            {!user.emailVerifiedAt && <ResendEmailButton />}
          </div>
        )}
      </section>
      <section aria-labelledby="profile-h" className="flex flex-col gap-3">
        <h2 id="profile-h" className="text-lg font-semibold">
          Profile
        </h2>
        <ProfileForm
          defaults={{ name: user.name ?? "", phone: localPhone(user.phone), email: user.email ?? "", avatarUrl: user.avatarUrl ?? "" }}
        />
      </section>
      <nav aria-label="Account" className="flex flex-wrap gap-4">
        <Link className="underline" href="/account/addresses">
          My addresses
        </Link>
        <Link className="underline" href="/account/returns">
          My returns
        </Link>
        <Link className="underline" href="/account/complaints">
          My complaints
        </Link>
        {user.isPlatformAdmin && (
          <Link className="underline" href="/admin/users">
            Manage users
          </Link>
        )}
        {user.isPlatformAdmin && (
          <>
            <Link className="underline" href="/admin/metrics">
              Marketplace metrics
            </Link>
            <Link className="underline" href="/admin/orders">
              All shop orders
            </Link>
            <Link className="underline" href="/admin/payouts">
              Payouts
            </Link>
          </>
        )}
        <LogoutButton />
      </nav>
    </div>
  );
}

export async function VerifyPhonePage() {
  const { id } = await userOrLogin("/account/verify-phone");
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, select: { phone: true, phoneVerifiedAt: true } });
  if (!user.phone) {
    return (
      <p>
        You have no mobile number yet.{" "}
        <Link className="underline" href="/account">
          Add one to your profile
        </Link>
        .
      </p>
    );
  }
  if (user.phoneVerifiedAt) return <p role="status">Your mobile number {localPhone(user.phone)} is verified.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p>
        We will send a 6-digit code to <strong>{localPhone(user.phone)}</strong>. You need a verified mobile number for cash on
        delivery.
      </p>
      <VerifyPhoneForms />
      <Link className="underline" href="/account">
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
    <div className="flex flex-col gap-8">
      <section aria-labelledby="list-h" className="flex flex-col gap-3">
        <h2 id="list-h" className="text-lg font-semibold">
          Saved addresses
        </h2>
        {addresses.length === 0 && <p>No saved addresses yet.</p>}
        <ul className="flex flex-col gap-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded border border-gray-300 p-3">
              <p className="font-medium">
                {a.name} · {localPhone(a.phone)}
                {a.isDefault && <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-sm text-blue-900">Default</span>}
              </p>
              <p>
                {a.line1}, {a.area}, {a.upazila}, {a.district}, {a.division}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <Link className="underline" href={`/account/addresses?edit=${a.id}`}>
                  Edit<span className="sr-only"> address for {a.name}</span>
                </Link>
                {!a.isDefault && (
                  <form action={setDefaultAddressAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="underline" type="submit">
                      Make default
                    </button>
                  </form>
                )}
                <form action={deleteAddressAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-red-700 underline" type="submit">
                    Delete<span className="sr-only"> address for {a.name}</span>
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="form-h" className="flex flex-col gap-3">
        <h2 id="form-h" className="text-lg font-semibold">
          {editing ? "Edit address" : "Add an address"}
        </h2>
        <AddressForm
          key={editing?.id ?? "new"}
          defaults={
            editing
              ? { ...editing, phone: localPhone(editing.phone) }
              : { ...emptyAddress, name: name ?? "", phone: localPhone(phone) }
          }
        />
        {editing && (
          <Link className="underline" href="/account/addresses">
            Cancel editing
          </Link>
        )}
      </section>
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
