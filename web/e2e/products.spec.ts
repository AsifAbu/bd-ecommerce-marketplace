import { expect, test, type Page } from "@playwright/test";

// Needs the seeded database (`npm run seed`). MinIO is not needed: no images are uploaded.
// US-030: staff create a processor listing through the generated form, see it in the list and
// deactivate it. Staff of another shop are refused.

async function login(page: Page, identifier: string, callbackUrl: string) {
  await page.goto(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel(/mobile.*email/i).fill(identifier);
  await page.getByLabel("Password").fill("Test@12345");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(`**${callbackUrl}`);
}

/** A form control by its label; required fields have a " *" marker after the name. */
function field(page: Page, name: string) {
  return page.getByLabel(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`));
}

test("staff create a processor listing through the form, see it listed and deactivate it", async ({ page }) => {
  const title = `[TEST] E2E Ryzen 7 ${Date.now()}`;
  await login(page, "staff.tech@ecom.test", "/seller");
  await page.getByRole("link", { name: /Test Tech Shop/ }).click();
  await page.waitForURL(/\/seller\/[^/]+$/);
  const shopUrl = new URL(page.url()).pathname;

  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("link", { name: "Add a product" }).click();
  await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Electronics › Computer Components › Processor" });

  // The form shows Processor's attributes and the guideline fields.
  for (const label of ["Brand", "Socket", "Core count", "Base clock (GHz)", "Country of origin", "Return eligibility"]) {
    await expect(field(page, label)).toBeVisible();
  }
  await expect(page.getByLabel("Author")).toHaveCount(0);

  // Required fields left empty: the save is blocked and the fields show errors.
  await page.getByRole("button", { name: "Create product" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("Socket is required")).toBeVisible();
  await expect(field(page, "Socket")).toHaveAttribute("aria-invalid", "true");

  await field(page, "Title").fill(title);
  await field(page, "Description").fill("8 cores, AM5, boxed.");
  await field(page, "Brand").selectOption({ label: "AMD" });
  await field(page, "Socket").selectOption({ label: "AM5" });
  await field(page, "Core count").fill("8");
  await field(page, "Base clock (GHz)").fill("4.2");
  await field(page, "Quantity").fill("1");
  await field(page, "Unit").selectOption("pcs");
  await field(page, "Weight (for delivery charge) (g)").fill("400");
  await field(page, "Country of origin").fill("China");
  await field(page, "Return eligibility").selectOption({ label: "Returnable" });
  await field(page, "Price (Tk)").fill("32500");
  await field(page, "Stock").fill("5");
  await page.getByRole("button", { name: "Create product" }).click();

  await expect(page.getByText("Product created. Add images below.")).toBeVisible();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("link", { name: "All products" }).click();
  const row = page.getByRole("row").filter({ hasText: title });
  await expect(row).toContainText("Processor");
  await expect(row).toContainText("Tk 32,500");
  await expect(row).toContainText("Active");

  await row.getByRole("button", { name: `Deactivate ${title}` }).click();
  await expect(row).toContainText("Inactive");
  await expect(row.getByRole("button", { name: `Activate ${title}` })).toBeVisible();

  // Staff of another shop can't open these pages or create products for this shop.
  const other = await (await page.context().browser()!.newContext()).newPage();
  await login(other, "staff.books@ecom.test", "/seller");
  await other.goto(`${shopUrl}/products`);
  await expect(other.getByText(/could not be found/i)).toBeVisible();
  await expect(other.getByText(title)).toHaveCount(0);
  const res = await other.request.post(`/api${shopUrl.replace("/seller", "/shops")}/products`, {
    data: { categoryId: "x", title: "Nope", description: "Nope", attributes: {}, variants: [] },
  });
  expect(res.status()).toBe(403);
});

test("staff import products from CSV: every error is listed and nothing is imported, then a valid file imports", async ({ page }) => {
  const stamp = Date.now();
  await login(page, "staff.tech@ecom.test", "/seller");
  await page.getByRole("link", { name: /Test Tech Shop/ }).click();
  await page.waitForURL(/\/seller\/[^/]+$/);
  await page.getByRole("link", { name: "Products", exact: true }).click();
  await page.getByRole("link", { name: "Import products from CSV" }).click();
  await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Electronics › Computer Components › Processor" });
  await expect(page.getByRole("cell", { name: "One of: AM4, AM5, LGA1700, LGA1851" })).toBeVisible();

  const header = "handle,title,description,sku,price,stock,brand,socket,core_count,base_clock_ghz,quantity,quantity_unit,weight_g,country_of_origin,return_eligibility";
  const row = (title: string, socket: string) => `,${title},Desktop CPU,,15000,3,AMD,${socket},6,3.5,1,pcs,300,China,Returnable`;
  const upload = (rows: string[]) =>
    page.getByLabel("CSV file").setInputFiles({ name: "products.csv", mimeType: "text/csv", buffer: Buffer.from([header, ...rows].join("\n")) });

  await upload([row(`[TEST] CSV A ${stamp}`, "AM9"), row(`[TEST] CSV B ${stamp}`, "AM5")]);
  await page.getByRole("button", { name: "Import products" }).click();
  await expect(page.getByText("Nothing was imported: 1 problem found")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: '"AM9" is not an allowed Socket option' })).toContainText("2");

  await upload([row(`[TEST] CSV A ${stamp}`, "AM4"), row(`[TEST] CSV B ${stamp}`, "AM5")]);
  await page.getByRole("button", { name: "Import products" }).click();
  await expect(page.getByText("Imported 2 products.")).toBeVisible();
  await page.getByRole("link", { name: "See your products" }).click();
  await expect(page.getByRole("row").filter({ hasText: `[TEST] CSV A ${stamp}` })).toContainText("Active");

  // Edit page: quick stock update.
  await page.getByRole("link", { name: `[TEST] CSV B ${stamp}` }).click();
  await page.getByLabel("Stock: Default").fill("9");
  await page.getByRole("button", { name: "Update stock" }).click();
  await expect(page.getByText("Stock updated")).toBeVisible();
});

test("the category dropdown changes the form, and a new product can start from one of the shop's own products", async ({ page }) => {
  await login(page, "staff.tech@ecom.test", "/seller");
  await page.getByRole("link", { name: /Test Tech Shop/ }).click();
  await page.waitForURL(/\/seller\/[^/]+$/);
  await page.goto(`${new URL(page.url()).pathname}/products/new`);

  // No category yet: no form. Choosing one shows that category's form; choosing another changes it.
  await expect(page.getByRole("button", { name: "Create product" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Electronics › Computer Components › Processor" });
  await expect(field(page, "Socket")).toBeVisible();
  await page.getByRole("combobox", { name: "Category" }).selectOption({ label: "Electronics › Computer Components › RAM" });
  await expect(field(page, "Socket")).toHaveCount(0);

  // Search the shop's own products and start from one: title and details are filled, stock is empty.
  await page.getByRole("searchbox", { name: "Search your products" }).fill("Ryzen 5 7600");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("list", { name: "Your products" }).getByRole("link").first().click();
  await expect(page.getByText(/Filled in from/)).toBeVisible();
  await expect(field(page, "Title")).toHaveValue(/Ryzen 5 7600/);
  await expect(field(page, "Socket")).toBeVisible();
  await expect(field(page, "Stock")).toHaveValue("");
});
