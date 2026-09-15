import { expect, test } from "@playwright/test";

// Phase 1 design-foundation checks: focused behaviour/accessibility smoke
// tests for the interactive primitives demonstrated on /design-system.
// Not a substitute for real feature e2e tests (added per-flow from Phase 6
// onward) — this only protects the primitives themselves.

test.beforeEach(async ({ page }) => {
  await page.goto("/design-system");
});

test("dialog opens on trigger and closes on Escape", async ({ page }) => {
  await page.getByRole("button", { name: "Annuler la commande…" }).click();
  const dialog = page.getByRole("dialog", { name: /Annuler la commande ECM-2026-0143/ });
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("sheet opens on trigger and closes via close button", async ({ page }) => {
  await page.getByRole("button", { name: "Filtres" }).click();
  const sheet = page.getByRole("dialog", { name: "Filtrer les commandes" });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).not.toBeVisible();
});

test("select opens and changes value", async ({ page }) => {
  const trigger = page.getByRole("combobox", { name: /Canton|Sélectionner un canton/ }).first();
  await trigger.click();
  await page.getByRole("option", { name: "Genève" }).click();
  await expect(trigger).toHaveText("Genève");
});

test("checkbox toggles checked state", async ({ page }) => {
  const checkbox = page.getByRole("checkbox", { name: /conditions de la vente/ });
  await expect(checkbox).toHaveAttribute("data-state", "unchecked");
  await checkbox.click();
  await expect(checkbox).toHaveAttribute("data-state", "checked");
  await checkbox.click();
  await expect(checkbox).toHaveAttribute("data-state", "unchecked");
});

test("radio group only allows one selection at a time", async ({ page }) => {
  const twint = page.getByRole("radio", { name: /TWINT/ });
  const card = page.getByRole("radio", { name: /Carte/ });

  await expect(twint).toHaveAttribute("data-state", "checked");
  await card.click();
  await expect(card).toHaveAttribute("data-state", "checked");
  await expect(twint).toHaveAttribute("data-state", "unchecked");
});

test("combobox is searchable and selects a member", async ({ page }) => {
  const trigger = page.getByRole("combobox", { name: "Membre Mélodia" });
  await trigger.click();

  const searchInput = page.getByPlaceholder("Rechercher un membre…");
  await expect(searchInput).toBeVisible();
  await searchInput.fill("Favre");

  const option = page.getByRole("option", { name: "Marc Favre" });
  await expect(option).toBeVisible();
  await option.click();

  await expect(trigger).toHaveText("Marc Favre");
});

test("combobox clear option resets the selection", async ({ page }) => {
  const trigger = page.getByRole("combobox", { name: "Membre Mélodia" });
  await trigger.click();
  await page.getByRole("option", { name: "Marc Favre" }).click();
  await expect(trigger).toHaveText("Marc Favre");

  await trigger.click();
  await page.getByRole("option", { name: /Aucun membre/ }).click();
  await expect(trigger).toHaveText("Aucun membre sélectionné");
});

test("quantity selector increments, decrements, and clamps at zero", async ({ page }) => {
  const group = page.getByRole("group", { name: "Quantité — Chasselas" });
  const value = group.locator("span[aria-live='polite']");
  const decrement = group.getByRole("button", { name: /Diminuer/ });
  const increment = group.getByRole("button", { name: /Augmenter/ });

  await expect(value).toHaveText("2");
  await increment.click();
  await expect(value).toHaveText("3");

  await decrement.click();
  await decrement.click();
  await decrement.click();
  await expect(value).toHaveText("0");
  await expect(decrement).toBeDisabled();
});
