import { expect, test } from "./support/fixtures";

// Phase 15 — TBD-SEC-006: browser coverage for the one combined public
// privacy/legal-information page, its footer link, the developer
// credit, and the checkout prior-information link. Nothing here
// touches the database — this is entirely static content plus one
// client-side cart interaction, matching cart.spec.ts's own precedent.

test("the privacy/legal page renders with its expected sections", async ({ page }) => {
  await page.goto("/confidentialite");
  await expect(
    page.getByRole("heading", { name: "Confidentialité & mentions légales", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Responsable" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Données collectées" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Conservation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Stockage local et cookies" })).toBeVisible();
  await expect(page.getByRole("link", { name: "communications@ecmelodia.ch" })).toHaveAttribute(
    "href",
    "mailto:communications@ecmelodia.ch",
  );
});

test("the public footer links to the privacy page and credits the developer", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Confidentialité & mentions légales" }),
  ).toHaveAttribute("href", "/confidentialite");
  const devCredit = page.getByRole("link", { name: "Anthony David" });
  await expect(devCredit).toHaveAttribute("href", "mailto:info@anthonydavid.ch");
});

test("checkout shows a prior-information notice linking to the privacy page, with no consent checkbox", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#selection").getByRole("button", { name: "Ajouter" }).first().click();
  await page.goto("/commande");

  await expect(
    page.getByText(
      "Les informations fournies sont utilisées pour traiter et livrer votre commande.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "En savoir plus sur la confidentialité" }),
  ).toHaveAttribute("href", "/confidentialite");

  // No consent workflow was introduced — transparent information only.
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});
