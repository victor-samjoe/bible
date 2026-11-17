import { expect, test, type Page } from "@playwright/test";

/**
 * Regressão do leitor (tarefa C8).
 *
 * Cobre o que o contrato exige da experiência de leitura: a raiz levar ao
 * leitor, cabeçalho fixo, menu acessível, troca de tema, navegação real por
 * livro/capítulo e leitura em viewport móvel.
 *
 * Estes testes leem o corpus publicado pelo servidor: não criam, não alteram e
 * não inventam dado algum. Nenhum número de versículo é afirmado como verdade
 * absoluta — o que se verifica é que o capítulo veio do corpus com versículos
 * numerados em ordem, e não texto fixo no componente.
 */

const MOBILE = { width: 390, height: 844 };

async function horizontalOverflow(page: Page): Promise<number> {
  return await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe("leitor: porta de entrada", () => {
  test("a raiz abre o leitor em um capítulo real", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/biblia\/[a-z0-9-]+\/\d+$/);

    const verses = page.locator(".verseButton");
    await expect(verses.first()).toBeVisible();
    expect(await verses.count()).toBeGreaterThan(1);

    // Numeração em ordem crescente, começando em 1: vem do capítulo, não de texto fixo.
    const numbers = await page.locator(".verseButton > sup").allInnerTexts();
    const parsed = numbers.map((value) => Number(value.trim()));
    expect(parsed[0]).toBe(1);
    expect(parsed).toEqual([...parsed].sort((left, right) => left - right));

    // Atribuição obrigatória da licença visível junto ao texto.
    await expect(page.locator(".readerFooter")).toContainText("BLIVRE");
  });

  test("/biblia redireciona para o primeiro livro do corpus", async ({ page }) => {
    const response = await page.goto("/biblia");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/biblia\/[a-z0-9-]+\/1$/);
  });

  test("referência inexistente responde 404 em vez de inventar texto", async ({ page }) => {
    for (const path of ["/biblia/livro-que-nao-existe/1", "/biblia/joao/999"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
  });
});

test.describe("leitor: cabeçalho e menu", () => {
  test("o cabeçalho continua visível depois de rolar o capítulo", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    const header = page.locator(".readerTop");
    await expect(header).toBeVisible();
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");

    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(header).toBeInViewport();
  });

  test("o menu de ferramentas é acessível por nome, abre em diálogo e fecha com Escape", async ({
    page,
  }) => {
    await page.goto("/biblia/joao/3");
    const trigger = page.getByRole("button", { name: "Abrir ferramentas de leitura" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Ferramentas de leitura" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    for (const name of ["Leitura", "Versões", "Versículo"]) {
      await expect(dialog.getByRole("button", { name, exact: true })).toBeVisible();
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("traduções sem licença aparecem como indisponíveis, sem prometer prazo", async ({
    page,
  }) => {
    await page.goto("/biblia/joao/3");
    await page.getByRole("button", { name: "Abrir ferramentas de leitura" }).click();
    const dialog = page.getByRole("dialog", { name: "Ferramentas de leitura" });
    await dialog.getByRole("button", { name: "Versões", exact: true }).click();

    await expect(dialog.getByText("Em licenciamento")).toHaveCount(3);
    for (const code of ["NVI", "NTLH", "Almeida"]) {
      await expect(dialog.getByRole("button", { name: new RegExp(code) })).toBeDisabled();
    }
  });
});

test.describe("leitor: tema", () => {
  test("alterna claro e escuro e mantém a escolha na sessão", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    const readTheme = () => page.evaluate(() => document.documentElement.dataset.readerTheme);
    const shellBackground = () =>
      page.locator(".readerShell").evaluate((el) => getComputedStyle(el).backgroundColor);

    await expect.poll(readTheme).toBe("dark");
    const dark = await shellBackground();

    await page.getByRole("button", { name: "Ativar tema claro" }).click();
    await expect.poll(readTheme).toBe("light");
    expect(await shellBackground()).not.toBe(dark);

    // Sobrevive a recarregar e a navegar para outro capítulo na mesma aba.
    await page.reload();
    await expect.poll(readTheme).toBe("light");
    await page.goto("/biblia/genesis/1");
    await expect.poll(readTheme).toBe("light");

    await page.getByRole("button", { name: "Ativar tema escuro" }).click();
    await expect.poll(readTheme).toBe("dark");
  });
});

test.describe("leitor: navegação por livro e capítulo", () => {
  test("o seletor de livro e de capítulo leva a uma URL compartilhável", async ({ page }) => {
    await page.goto("/biblia/genesis/1");

    await page.locator(".readerPick > button").first().click();
    const bookDialog = page.getByRole("dialog", { name: "Escolher livro" });
    await expect(bookDialog).toBeVisible();
    await bookDialog.getByRole("link", { name: /João/ }).first().click();
    await expect(page).toHaveURL(/\/biblia\/joao\/1$/);

    await page.locator(".readerPick > button").nth(1).click();
    const chapterDialog = page.getByRole("dialog", { name: "Escolher capítulo" });
    await expect(chapterDialog).toBeVisible();
    await chapterDialog.getByRole("link", { name: "3", exact: true }).click();
    await expect(page).toHaveURL(/\/biblia\/joao\/3$/);
    await expect(page.locator("#chapter-title")).toContainText("3");
  });

  test("anterior e seguinte atravessam a fronteira do livro", async ({ page }) => {
    await page.goto("/biblia/genesis/1");
    await expect(page.locator(".chapterNav a[rel=prev]")).toHaveCount(0);

    await page.goto("/biblia/exodo/1");
    const previous = page.locator(".chapterNav a[rel=prev]");
    await expect(previous).toContainText("Gênesis");
    await previous.click();
    await expect(page).toHaveURL(/\/biblia\/genesis\/\d+$/);
    // Volta para o ÚLTIMO capítulo de Gênesis, não para o primeiro.
    expect(page.url()).not.toMatch(/\/genesis\/1$/);
  });

  test("marcações locais não vazam entre capítulos", async ({ page }) => {
    await page.goto("/biblia/genesis/1");
    await page.locator(".verseButton").nth(2).click();
    const dialog = page.getByRole("dialog", { name: "Ferramentas de leitura" });
    await dialog.getByRole("button", { name: /Destacar/ }).click();
    await expect(page.locator(".verseButton").nth(2)).toHaveAttribute("data-highlighted", "true");
    await page.keyboard.press("Escape");

    await page.goto("/biblia/joao/3");
    await expect(page.locator(".verseButton[data-highlighted]")).toHaveCount(0);

    await page.goto("/biblia/genesis/1");
    await expect(page.locator(".verseButton").nth(2)).toHaveAttribute("data-highlighted", "true");
  });
});

test.describe("leitor: viewport móvel", () => {
  test.use({ viewport: MOBILE });

  test("lê sem rolagem horizontal e com o cabeçalho fixo", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(await page.locator(".readerTop").evaluate((el) => getComputedStyle(el).position)).toBe(
      "sticky",
    );

    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(page.locator(".readerTop")).toBeInViewport();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("os painéis cabem na tela e as ferramentas seguem alcançáveis", async ({ page }) => {
    await page.goto("/biblia/joao/3");

    await page.locator(".readerPick > button").first().click();
    await expect(page.getByRole("dialog", { name: "Escolher livro" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Abrir ferramentas de leitura" }).click();
    const tools = page.getByRole("dialog", { name: "Ferramentas de leitura" });
    await expect(tools).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    // O controle de tema precisa existir aqui: no mobile o cabeçalho o esconde.
    await tools.getByRole("button", { name: "Leitura", exact: true }).click();
    await tools.getByRole("button", { name: "Claro", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset.readerTheme))
      .toBe("light");
  });

  test("o tamanho do texto muda e a escolha vale no capítulo seguinte", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    const fontSize = () =>
      page.locator(".scripture").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const before = await fontSize();

    await page.getByRole("button", { name: "Abrir ferramentas de leitura" }).click();
    const tools = page.getByRole("dialog", { name: "Ferramentas de leitura" });
    await tools.getByRole("button", { name: "A+", exact: true }).click();
    const after = await fontSize();
    expect(after).toBeGreaterThan(before);

    await page.keyboard.press("Escape");
    await page.goto("/biblia/joao/4");
    expect(await fontSize()).toBeCloseTo(after, 1);
  });
});
