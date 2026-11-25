import { expect, test } from "@playwright/test";

test("voltar do estudo restaura o versículo e a palavra selecionada", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/biblia/genesis/1");
  await page.locator(".verseButton").nth(4).click();
  const bar = page.getByRole("region", { name: "Ações da seleção" });
  await bar.getByRole("button", { name: /^Aplicar/ }).click();
  await bar.getByRole("button", { name: /Consultar original/ }).click();
  const original = page.getByRole("dialog", { name: "Consultar original" });
  await expect(original).toContainText("Hebraico · MorphHB");
  const words = original.locator('p[lang="he"] button');
  for (let index = 0; index < await words.count(); index++) {
    await words.nth(index).click();
    if (await original.getByRole("link", { name: /Estudar palavra H216/ }).count()) break;
  }
  const study = original.getByRole("link", { name: /Estudar palavra H216/ });
  await expect(study).toBeVisible();
  await study.click();
  await expect(page).toHaveURL(/\/palavra\?/);
  await page.getByRole("link", { name: "← Voltar", exact: true }).click();
  await expect(page).toHaveURL(/\/biblia\/genesis\/1/);
  await expect(original).toBeVisible();
  await expect(original.getByRole("link", { name: /Estudar palavra H216/ })).toBeVisible();
  await expect(original.getByLabel("Análise da palavra")).toBeInViewport();
});
