import { expect, test } from "@playwright/test";

test("home page loads and shows the Test mode banner", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Marketplace" })).toBeVisible();
  await expect(page.getByTestId("test-mode-banner")).toContainText("Test mode");
});
