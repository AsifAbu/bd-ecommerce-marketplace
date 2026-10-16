import { expect, test, type Page } from "@playwright/test";

// Needs the seeded database and MinIO (`npm run seed`). Medicine shop: apply, then the admin
// must verify the licence before approval. Staff of another shop can't open it.

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel(/mobile.*email/i).fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(`**${callbackUrl}`);
}

test("medicine shop: apply, verify licence, approve; other shops' staff get 404", async ({ browser }) => {
  const slug = `e2e-pharmacy-${Date.now()}`;
  const name = `[TEST] E2E Pharmacy ${Date.now()}`;

  const applicant = await (await browser.newContext()).newPage();
  await login(applicant, "customer.new@ecom.test", "/shops/apply");
  await applicant.getByLabel("Shop name").fill(name);
  await applicant.getByLabel("Shop link").fill(slug);
  await applicant.getByLabel("Shop type").selectOption("medicine");
  await applicant.getByLabel("Owner NID number").fill("1234567890");
  await applicant.getByLabel("Owner photo").setInputFiles({ name: "me.txt", mimeType: "text/plain", buffer: Buffer.from("x") });

  // Medicine without licence is blocked.
  await applicant.getByRole("button", { name: "Submit application" }).click();
  await expect(applicant.getByText("Licence number is required")).toBeVisible();

  await applicant.getByLabel("Licence number").fill("E2E-DGDA-1");
  await applicant.getByLabel("Expiry date").fill("2030-12-31");
  await applicant.getByLabel("Licence certificate").setInputFiles({ name: "cert.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  await applicant.getByRole("button", { name: "Submit application" }).click();
  await applicant.waitForURL(/\/seller\/[^/]+$/);
  await expect(applicant.getByRole("heading", { name })).toBeVisible();
  await expect(applicant.getByText("pending").first()).toBeVisible();
  const shopUrl = new URL(applicant.url()).pathname;

  const admin = await (await browser.newContext()).newPage();
  await login(admin, "admin@ecom.test", "/admin/shops");
  const application = admin.getByRole("article").filter({ hasText: slug });
  await application.getByRole("button", { name: "Approve" }).click();
  await expect(application.getByRole("alert")).toContainText("Verify the medicine licence");

  await admin.getByRole("article").filter({ hasText: "E2E-DGDA-1" }).getByRole("button", { name: "Verify licence" }).click();
  // The verified licence leaves the queue; the application now shows it as verified.
  await expect(application).toContainText("E2E-DGDA-1 (verified");
  await application.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByRole("article").filter({ hasText: name }).getByRole("button", { name: "Suspend" })).toBeVisible();

  const otherStaff = await (await browser.newContext()).newPage();
  await login(otherStaff, "staff.books@ecom.test", "/seller");
  // The page streams, so the 404 UI arrives with HTTP 200; check that nothing of the shop is shown.
  await otherStaff.goto(shopUrl);
  await expect(otherStaff.getByText(/could not be found/i)).toBeVisible();
  await expect(otherStaff.getByText(name)).toHaveCount(0);
});

test("owner invites staff by email; the invitee accepts; the owner removes them", async ({ browser, request }) => {
  const invitee = "customer.verified@ecom.test";
  const owner = await (await browser.newContext()).newPage();
  await login(owner, "owner.books@ecom.test", "/seller");
  await owner.getByRole("link", { name: /Test Book Shop/ }).click();
  await owner.waitForURL(/\/seller\/[^/]+$/);
  const shopUrl = new URL(owner.url()).pathname;
  await owner.getByLabel("Staff email").fill(invitee);
  await owner.getByRole("button", { name: "Send invite" }).click();
  await expect(owner.getByText(`Invite sent to ${invitee}`)).toBeVisible();

  // Read the invite link from Mailpit (test mode mail catcher).
  const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";
  const query = encodeURIComponent(`to:${invitee} subject:invited`);
  const search = await (await request.get(`${mailpit}/api/v1/search?query=${query}&limit=1`)).json();
  const message = await (await request.get(`${mailpit}/api/v1/message/${search.messages[0].ID}`)).json();
  const link = (message.Text as string).match(/https?:\/\/\S+\/seller\/invite\/\S+/)![0];

  const staff = await (await browser.newContext()).newPage();
  await login(staff, invitee, new URL(link).pathname);
  await staff.getByRole("button", { name: "Accept invite" }).click();
  await staff.waitForURL(`**${shopUrl}`);
  await expect(staff.getByText("your role: staff")).toBeVisible();
  await expect(staff.getByRole("heading", { name: "Staff" })).toHaveCount(0);

  await owner.reload();
  await owner.getByRole("listitem").filter({ hasText: invitee }).getByRole("button", { name: "Remove" }).click();
  await expect(owner.getByRole("listitem").filter({ hasText: invitee })).toHaveCount(0);
});
