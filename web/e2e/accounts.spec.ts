import { expect, test, type Page } from "@playwright/test";

// Needs seed data (`npm run seed`) and test mode (OTP 123456).
const randomMobile = () => `019${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

async function login(page: Page, identifier: string, password = "Test@12345") {
  await page.goto("/login");
  await page.getByLabel("Mobile number or email").fill(identifier);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();
}

test("sign up with mobile, verify by OTP, save an address, log out", async ({ page }) => {
  const mobile = randomMobile();
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Shopper");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Password").fill("Secret@123");
  await page.getByLabel(/I have read and accept/).check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Verify your mobile number" })).toBeVisible();
  await page.getByRole("button", { name: "Send code by SMS" }).click();
  await expect(page.getByText("We sent a 6-digit code")).toBeVisible();
  await page.getByLabel("6-digit code").fill("123456");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Your mobile number is verified.")).toBeVisible();

  await page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Addresses" }).click();
  await page.getByLabel("Division").selectOption("Dhaka");
  await page.getByLabel("District").selectOption("Dhaka");
  // The upazila list loads after the district is chosen (a text input until then).
  await expect(page.getByRole("combobox", { name: "Upazila or thana" })).toBeVisible();
  await page.getByLabel("Upazila or thana").selectOption("Gulshan");
  await page.getByLabel("Area").fill("Gulshan 2");
  await page.getByLabel("Address line").fill("House 1, Road 90");
  await page.getByRole("button", { name: "Add address" }).click();
  await expect(page.getByText("House 1, Road 90, Gulshan 2, Gulshan, Dhaka, Dhaka")).toBeVisible();
  await expect(page.getByText("Default", { exact: true })).toBeVisible();

  await page.goto("/account");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount/);
});

const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** Latest link to this app in the newest Mailpit email sent to `to`. */
async function linkFromEmail(page: Page, to: string, subject: string) {
  let link: string | undefined;
  await expect(async () => {
    const search = await (await page.request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to} subject:"${subject}"`)}`)).json();
    const id = search.messages?.[0]?.ID;
    expect(id).toBeTruthy();
    const msg = await (await page.request.get(`${MAILPIT}/api/v1/message/${id}`)).json();
    link = /https?:\/\/\S+/.exec(msg.Text)?.[0];
    expect(link).toBeTruthy();
  }).toPass({ timeout: 10_000 });
  return new URL(link!).pathname + new URL(link!).search;
}

test("sign up with email, verify it by link, reset the password by email link", async ({ page }) => {
  const email = `e2e.${Date.now()}@ecom.test`;
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Email User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("Secret@123");
  await page.getByLabel(/I have read and accept/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "My account" })).toBeVisible();

  await page.goto(await linkFromEmail(page, email, "Verify your email"));
  await expect(page.getByText("Your email is verified.")).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();

  await page.goto("/forgot-password");
  await page.getByLabel("Mobile number or email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("we have sent a reset link")).toBeVisible();
  await page.goto(await linkFromEmail(page, email, "Reset your password"));
  await page.getByLabel("New password").fill("Changed@123");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your password was changed.")).toBeVisible();
  await login(page, email, "Changed@123");
});

test("reset the password by SMS code", async ({ page }) => {
  const mobile = randomMobile();
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E SMS User");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Password").fill("Secret@123");
  await page.getByLabel(/I have read and accept/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Verify your mobile number" })).toBeVisible();
  await page.context().clearCookies();

  await page.goto("/forgot-password");
  await page.getByLabel("Mobile number or email").fill(mobile);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Reset password by SMS code" })).toBeVisible();
  await page.getByLabel("Code").fill("000000");
  await page.getByLabel("New password").fill("Changed@123");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("That code is not right")).toBeVisible();
  await page.getByLabel("Code").fill("123456");
  await page.getByLabel("New password").fill("Changed@123");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your password was changed.")).toBeVisible();
  await login(page, mobile, "Changed@123");
  await expect(page.getByText(`Mobile ${mobile}`)).toContainText("Verified");
});

test("5 wrong passwords lock the login for 15 minutes, with the same generic error", async ({ page }) => {
  const mobile = randomMobile();
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("E2E Lockout User");
  await page.getByLabel("Mobile number").fill(mobile);
  await page.getByLabel("Password").fill("Secret@123");
  await page.getByLabel(/I have read and accept/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Verify your mobile number" })).toBeVisible();
  await page.context().clearCookies();

  const attempt = async (password: string) => {
    await page.goto("/login");
    await page.getByLabel("Mobile number or email").fill(mobile);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Wrong mobile number, email or password")).toBeVisible();
  };
  for (let i = 0; i < 5; i++) await attempt("Wrong@1234");
  await attempt("Secret@123"); // right password, but locked
});

test("a customer cannot use admin user management", async ({ page }) => {
  await login(page, "customer.new@ecom.test");
  const res = await page.request.get("/api/admin/users");
  expect(res.status()).toBe(403);
  await page.goto("/admin/users");
  await expect(page.getByText("Not allowed")).toBeVisible();
});

test("a Platform Admin can find and suspend, then reactivate a user", async ({ page }) => {
  await login(page, "01700000001");
  await page.goto("/admin/users?q=customer.flagged");
  const row = page.getByRole("row", { name: /customer\.flagged@ecom\.test/ });
  await row.getByRole("button", { name: /^Suspend/ }).click();
  await expect(row.getByRole("cell", { name: "Suspended" })).toBeVisible();
  await row.getByRole("button", { name: /^Reactivate/ }).click();
  await expect(row.getByRole("cell", { name: "Active" })).toBeVisible();
});
