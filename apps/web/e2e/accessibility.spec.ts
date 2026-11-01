import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ITEM_ID, mockBackend, signIn } from "./support/mock-backend";

// Automated checks catch roughly the structural half of accessibility problems (names, labels, contrast,
// landmarks). They do not replace using the site with a keyboard and a screen reader.
const RULES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(RULES).analyze();
  const summary = violations.map(
    (violation) =>
      `${label} · ${violation.id} (${violation.impact}): ${violation.help}\n` +
      `    e.g. ${violation.nodes[0]?.target.join(" ")}\n    ${violation.nodes[0]?.html.slice(0, 160)}\n    ${violation.nodes[0]?.any[0]?.message ?? ""}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

const PUBLIC_PAGES: [string, string][] = [
  ["/", "home"],
  ["/login", "sign in"],
  ["/categories", "categories"],
  ["/listings", "homes"],
  ["/c/vehicles", "vehicles"],
  [`/item/${ITEM_ID}`, "item detail"],
  ["/terms", "terms"],
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`accessibility, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme, reducedMotion: "reduce" });

    for (const [path, label] of PUBLIC_PAGES) {
      test(`${label} page has no automatic violations`, async ({ page }) => {
        await mockBackend(page, "RENTER");
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        await expectNoViolations(page, label);
      });
    }
  });
}

test.describe("accessibility, signed-in pages", () => {
  test.use({ reducedMotion: "reduce" });

  test("renter and owner screens", async ({ page }) => {
    await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "My bookings" }).click();
    await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
    await expectNoViolations(page, "my bookings");

    await page.getByText("My activity").click();
    await page.getByRole("link", { name: "My listings" }).click();
    await expect(page.locator(".owner-property-card").first()).toBeVisible();
    await expectNoViolations(page, "my listings");

    await page.locator(".owner-property-card", { hasText: "Toyota Aqua" }).getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: /Edit listing/ })).toBeVisible();
    await expectNoViolations(page, "edit listing");
  });

  test("owner form for a new item", async ({ page }) => {
    await mockBackend(page, "OWNER");
    await signIn(page);
    await page.getByRole("link", { name: "For owners" }).click();
    await expectNoViolations(page, "list with us");
    await page.getByRole("link", { name: /Vehicles/ }).click();
    await expect(page.getByLabel("Vehicle type")).toBeVisible();
    await expectNoViolations(page, "new vehicle listing");
  });

  test("admin screens", async ({ page }) => {
    await mockBackend(page, "ADMIN");
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Your platform at a glance." })).toBeVisible();
    await expectNoViolations(page, "admin overview");
    for (const [link, heading] of [["Listings", "Listings"], ["Bookings", "Bookings"], ["Rental requests", "Rental requests"]] as const) {
      await page.getByRole("link", { name: link, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expectNoViolations(page, `admin ${link.toLowerCase()}`);
    }
  });
});
