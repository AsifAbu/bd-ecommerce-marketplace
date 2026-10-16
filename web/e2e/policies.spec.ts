import { expect, test, type Page } from "@playwright/test";

// Needs the seeded database (`npm run seed`): version 1 of every policy and the test admin.
// Serial: the sign-up test checks acceptance of the Terms version the first test publishes.
test.describe.configure({ mode: "serial" });

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel(/mobile.*email/i).fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(`**${callbackUrl}`);
}

test("admin publishes a new Terms version; the public page shows it and keeps the old one", async ({ page }) => {
  const marker = `E2E terms ${Date.now()}`;
  await login(page, "admin@ecom.test", "/admin/policies/terms");

  // Start a draft unless one is already open (e.g. from an interrupted run).
  const newDraft = page.getByRole("button", { name: /^Draft version \d+$/ });
  const publish = page.getByRole("button", { name: /^Publish version \d+$/ });
  await expect(newDraft.or(publish)).toBeVisible();
  if (await newDraft.isVisible()) await newDraft.click();
  await expect(publish).toBeVisible();
  const version = Number((await publish.textContent())!.match(/\d+/)![0]);

  await page.getByLabel("Title").fill("Terms and Conditions");
  await page.getByLabel("What changed (optional)").fill("E2E update");
  await page.getByLabel("Policy text").fill(`## Updated terms\n${marker}\n\nDBID: {{DBID}}`);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByText("Draft saved")).toBeVisible();
  await publish.click();
  await expect(page.getByRole("status").filter({ hasText: `Version ${version} published` })).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(`^Version ${version} Current`) })).toBeVisible();

  await page.goto("/policies/terms");
  await expect(page.getByRole("heading", { name: "Terms and Conditions", level: 1 })).toBeVisible();
  await expect(page.getByTestId("policy-version")).toContainText(`Version ${version}`);
  await expect(page.getByText(marker)).toBeVisible();
  await expect(page.getByRole("main").getByText(/DBID: TEST-DBID/)).toBeVisible();

  // The superseded version stays readable, unchanged.
  await page.goto(`/policies/terms?version=${version - 1}`);
  await expect(page.getByText("This is an earlier version.")).toBeVisible();
  await expect(page.getByText(marker)).toHaveCount(0);
});

test("a customer can't open the policies admin", async ({ page }) => {
  await login(page, "customer.verified@ecom.test", "/admin/policies");
  await expect(page.getByText("This page is for the Platform Admin only.")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("footer shows the DBID and policy links; the cookie notice stays dismissed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("footer-dbid")).toContainText("TEST-DBID");
  await expect(page.getByRole("navigation", { name: "Policies" }).getByRole("link", { name: "Return and Refund Policy" })).toHaveAttribute(
    "href",
    "/policies/returns",
  );

  const notice = page.getByTestId("cookie-notice");
  await expect(notice.getByRole("link", { name: "Cookie Policy" })).toHaveAttribute("href", "/policies/cookies");
  await notice.getByRole("button", { name: "OK, got it" }).click();
  await expect(notice).toHaveCount(0);
  await expect.poll(async () => (await page.context().cookies()).some((c) => c.name === "cookie_notice")).toBe(true);
  await page.reload();
  await expect(page.getByTestId("footer-dbid")).toBeVisible();
  await expect(page.getByTestId("cookie-notice")).toHaveCount(0);
});

test("sign-up needs the Terms and Privacy consent and records it", async ({ page }) => {
  const email = `e2e.policies.${Date.now()}@ecom.test`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Consent User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Secret@123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/Accept the Terms and Conditions and the Privacy Policy/)).toBeVisible();

  await page.getByLabel("Password").fill("Secret@123");
  await page.getByLabel(/I have read and accept/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();

  await page.goto("/account/policies");
  await expect(page.getByText("You have accepted the current Terms and Conditions and Privacy Policy.")).toBeVisible();
});
