import { expect, test, type Page } from "@playwright/test";

/**
 * Regressão do leitor (tarefas C8 e C13).
 *
 * Cobre a interação de leitura como ela é depois da C13: toque no versículo
 * seleciona, a barra de ações só existe com seleção, "lido" é estado do capítulo,
 * o menu de três pontos tem apenas configurações, e comparar traduções ou
 * consultar original só abrem a partir de uma seleção — sempre explicando a
 * indisponibilidade em vez de inventar dado.
 *
 * Estes testes leem o corpus publicado pelo servidor: não criam, não alteram e
 * não inventam dado algum.
 */

const MOBILE = { width: 390, height: 844 };

async function horizontalOverflow(page: Page): Promise<number> {
  return await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

function settingsTrigger(page: Page) {
  return page.getByRole("button", { name: "Abrir configurações de leitura" });
}

function settingsDialog(page: Page) {
  return page.getByRole("dialog", { name: "Configurações de leitura" });
}

function selectionBar(page: Page) {
  return page.getByRole("region", { name: "Ações da seleção" });
}

async function selectVerses(page: Page, indexes: readonly number[]) {
  for (const index of indexes) await page.locator(".verseButton").nth(index).click();
}

test.describe("leitor: porta de entrada", () => {
  test("a raiz abre o leitor em um capítulo real", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/biblia\/[a-z0-9-]+\/\d+$/);

    const verses = page.locator(".verseButton");
    await expect(verses.first()).toBeVisible();
    expect(await verses.count()).toBeGreaterThan(1);

    // Numeração em ordem crescente, começando em 1: vem do capítulo, não de texto fixo.
    const numbers = (await page.locator(".verseButton > sup").allInnerTexts()).map((value) =>
      Number(value.trim()),
    );
    expect(numbers[0]).toBe(1);
    expect(numbers).toEqual([...numbers].sort((left, right) => left - right));

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

test.describe("leitor: cabeçalho", () => {
  test("o cabeçalho continua visível depois de rolar o capítulo", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    const header = page.locator(".readerTop");
    await expect(header).toBeVisible();
    expect(await header.evaluate((el) => getComputedStyle(el).position)).toBe("sticky");

    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(header).toBeInViewport();
  });

  test('"lido" é uma ação única de capítulo, não de versículo', async ({ page }) => {
    await page.goto("/biblia/joao/3");
    const toggle = page.getByRole("button", { name: /Marcar João 3 como lido/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".readerProgress")).toContainText("ainda não marcado como lido");

    await toggle.click();
    await expect(page.getByRole("button", { name: /Desmarcar João 3 como lido/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator(".readerProgress")).toContainText("marcado como lido nesta sessão");

    // Outro capítulo começa não lido; o original continua lido na mesma aba.
    await page.goto("/biblia/joao/4");
    await expect(page.locator(".readerProgress")).toContainText("ainda não marcado como lido");
    await page.goto("/biblia/joao/3");
    await expect(page.locator(".readerProgress")).toContainText("marcado como lido nesta sessão");

    // Nenhum versículo oferece marcar leitura.
    await selectVerses(page, [0]);
    await selectionBar(page).getByRole("button", { name: /^Aplicar/ }).click();
    await expect(selectionBar(page).getByRole("button", { name: /Lido/ })).toHaveCount(0);
  });
});

test.describe("leitor: menu de três pontos", () => {
  test("contém apenas configurações de leitura", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    await expect(settingsTrigger(page)).toHaveAttribute("aria-expanded", "false");
    await settingsTrigger(page).click();

    const dialog = settingsDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    for (const section of ["Tema", "Tamanho do texto", "Fonte", "Espaçamento"]) {
      await expect(dialog.getByRole("heading", { name: section })).toBeVisible();
    }

    // Versões e ações de seleção não pertencem a esta tela.
    const text = await dialog.innerText();
    expect(text).not.toMatch(/Em licenciamento|Comparar|Destacar|Nota|Versículo selecionado/);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("oferece um tamanho menor além dos anteriores e aplica na hora", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    const fontSize = () =>
      page.locator(".scripture").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const padrao = await fontSize();

    await settingsTrigger(page).click();
    // "Padrão" existe em tamanho e em espaçamento: o grupo é que desambigua.
    const sizes = settingsDialog(page).getByRole("group", { name: "Tamanho do texto" });
    for (const name of ["Menor", "Pequeno", "Padrão", "Grande"]) {
      await expect(sizes.getByRole("button", { name, exact: true })).toBeVisible();
    }

    await sizes.getByRole("button", { name: "Menor", exact: true }).click();
    const menor = await fontSize();
    expect(menor).toBeLessThan(padrao);

    await sizes.getByRole("button", { name: "Grande", exact: true }).click();
    expect(await fontSize()).toBeGreaterThan(padrao);

    // A escolha vale no capítulo seguinte, na mesma sessão.
    const grande = await fontSize();
    await page.keyboard.press("Escape");
    await page.goto("/biblia/joao/4");
    expect(await fontSize()).toBeCloseTo(grande, 1);
  });

  test("alterna tema e mantém a escolha na sessão", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    const readTheme = () => page.evaluate(() => document.documentElement.dataset.readerTheme);
    await expect.poll(readTheme).toBe("dark");

    await settingsTrigger(page).click();
    await settingsDialog(page).getByRole("button", { name: "Claro", exact: true }).click();
    await expect.poll(readTheme).toBe("light");
    await page.keyboard.press("Escape");

    await page.reload();
    await expect.poll(readTheme).toBe("light");
    await page.goto("/biblia/genesis/1");
    await expect.poll(readTheme).toBe("light");

    await settingsTrigger(page).click();
    await settingsDialog(page).getByRole("button", { name: "Escuro", exact: true }).click();
    await expect.poll(readTheme).toBe("dark");
  });
});

test.describe("leitor: seleção múltipla", () => {
  test("tocar versículos seleciona vários sem abrir painel", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    await expect(selectionBar(page)).toHaveCount(0);

    await selectVerses(page, [0, 2]);
    // Nenhum diálogo é aberto pelo toque.
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const verses = page.locator(".verseButton");
    await expect(verses.nth(0)).toHaveAttribute("aria-pressed", "true");
    await expect(verses.nth(2)).toHaveAttribute("aria-pressed", "true");
    await expect(verses.nth(1)).toHaveAttribute("aria-pressed", "false");

    const bar = selectionBar(page);
    await expect(bar).toBeVisible();
    await expect(bar).toContainText("2 versículos selecionados");
    // A seleção descontínua é rotulada sem afirmar faixa.
    await expect(bar).toContainText("João 3:1,3");

    // Tocar de novo desseleciona.
    await verses.nth(0).click();
    await expect(verses.nth(0)).toHaveAttribute("aria-pressed", "false");
    await expect(bar).toContainText("1 versículo selecionado");

    await bar.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(selectionBar(page)).toHaveCount(0);
  });

  test("destaca por cor os versículos selecionados e não vaza entre capítulos", async ({
    page,
  }) => {
    await page.goto("/biblia/genesis/1");
    await selectVerses(page, [2, 3]);
    const bar = selectionBar(page);
    await bar.getByRole("button", { name: /^Aplicar/ }).click();
    await bar.getByRole("button", { name: "Verde", exact: true }).click();

    const verses = page.locator(".verseButton");
    await expect(verses.nth(2)).toHaveAttribute("data-highlight", "verde");
    await expect(verses.nth(3)).toHaveAttribute("data-highlight", "verde");
    await expect(page.locator(".readerProgress")).toContainText("destaques: 2");

    // Trocar a cor da mesma seleção substitui, não acumula.
    await bar.getByRole("button", { name: "Rosa", exact: true }).click();
    await expect(verses.nth(2)).toHaveAttribute("data-highlight", "rosa");
    await expect(page.locator(".readerProgress")).toContainText("destaques: 2");

    await page.goto("/biblia/joao/3");
    await expect(page.locator(".verseButton[data-highlight]")).toHaveCount(0);
    await expect(page.locator(".readerProgress")).toContainText("destaques: 0");

    await page.goto("/biblia/genesis/1");
    await expect(page.locator(".verseButton").nth(2)).toHaveAttribute("data-highlight", "rosa");

    // Remover destaque limpa só a seleção atual.
    await selectVerses(page, [2]);
    await selectionBar(page).getByRole("button", { name: /^Aplicar/ }).click();
    await selectionBar(page).getByRole("button", { name: "Remover destaque" }).click();
    await expect(page.locator(".verseButton").nth(2)).not.toHaveAttribute("data-highlight", "rosa");
    await expect(page.locator(".verseButton").nth(3)).toHaveAttribute("data-highlight", "rosa");
  });

  test("guarda nota ligada à seleção que a originou", async ({ page }) => {
    await page.goto("/biblia/genesis/1");
    await selectVerses(page, [0, 1]);
    const bar = selectionBar(page);
    await bar.getByRole("button", { name: /^Aplicar/ }).click();
    await bar.getByRole("button", { name: /Adicionar nota/ }).click();

    const dialog = page.getByRole("dialog", { name: "Nota da seleção" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Gênesis 1:1-2");
    await dialog.locator("textarea").fill("Nota de teste local.");
    await dialog.getByRole("button", { name: "Guardar nota" }).click();

    await expect(page.locator(".readerProgress")).toContainText("notas: 1");
    // O indicador aparece no primeiro versículo da seleção.
    await expect(page.locator(".verseButton").nth(0)).toContainText("✎");

    // A seleção continua ativa depois de guardar, e reabre a nota para edição.
    await expect(selectionBar(page)).toContainText("Gênesis 1:1-2");
    await selectionBar(page).getByRole("button", { name: /^Aplicar/ }).click();
    await selectionBar(page).getByRole("button", { name: /Editar nota/ }).click();
    const again = page.getByRole("dialog", { name: "Nota da seleção" });
    await expect(again.locator("textarea")).toHaveValue("Nota de teste local.");
    await again.getByRole("button", { name: "Apagar nota" }).click();
    await expect(page.locator(".readerProgress")).toContainText("notas: 0");
  });

  test("comparar traduções e original só existem com seleção e explicam a indisponibilidade", async ({
    page,
  }) => {
    await page.goto("/biblia/joao/3");
    // Sem seleção, não há barra e portanto não há como pedir comparação.
    await expect(selectionBar(page)).toHaveCount(0);

    await selectVerses(page, [15]);
    const bar = selectionBar(page);
    await bar.getByRole("button", { name: /^Aplicar/ }).click();
    await bar.getByRole("button", { name: /Comparar traduções/ }).click();

    const versions = page.getByRole("dialog", { name: "Comparar traduções" });
    await expect(versions).toBeVisible();
    await expect(versions.getByText("Em licenciamento")).toHaveCount(3);
    await expect(versions).toContainText("Disponível");
    await expect(versions).toContainText("não há o que comparar");
    await page.keyboard.press("Escape");

    await bar.getByRole("button", { name: /^Aplicar/ }).click();
    await bar.getByRole("button", { name: /Consultar original/ }).click();
    const original = page.getByRole("dialog", { name: "Consultar original" });
    await expect(original).toBeVisible();
    await expect(original).toContainText("indisponíveis");
    await expect(original).toContainText("João 3:16");
    // Nenhuma palavra em grego ou transliteração é exibida.
    await expect(original).not.toContainText(/[Ͱ-Ͽἀ-῿]/);
  });
});

test.describe("leitor: navegação por livro e capítulo", () => {
  test("escolher livro troca direto para os capítulos dele, sem reabrir o menu", async ({
    page,
  }) => {
    await page.goto("/biblia/genesis/1");
    await page.locator(".readerPick > button").first().click();
    const bookDialog = page.getByRole("dialog", { name: "Escolher livro" });
    await expect(bookDialog).toBeVisible();

    await bookDialog.getByRole("button", { name: /João/ }).first().click();

    // Sem clicar de novo no cabeçalho, o menu já está na lista de capítulos.
    const chapterDialog = page.getByRole("dialog", { name: "Escolher capítulo" });
    await expect(chapterDialog).toBeVisible();
    await expect(chapterDialog).toContainText("João");
    await expect(chapterDialog.getByRole("button", { name: "3", exact: true })).toBeVisible();

    await chapterDialog.getByRole("button", { name: "3", exact: true }).click();
    await expect(page).toHaveURL(/\/biblia\/joao\/3$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#chapter-title")).toContainText("3");
  });

  test("é possível voltar da lista de capítulos para a de livros", async ({ page }) => {
    await page.goto("/biblia/joao/3");
    await page.locator(".readerPick > button").nth(1).click();
    const chapterDialog = page.getByRole("dialog", { name: "Escolher capítulo" });
    await expect(chapterDialog).toBeVisible();

    await chapterDialog.getByRole("button", { name: "Voltar para a lista de livros" }).click();
    await expect(page.getByRole("dialog", { name: "Escolher livro" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Escolher livro" }).locator("li")).toHaveCount(66);
  });

  test("anterior e seguinte atravessam a fronteira do livro", async ({ page }) => {
    await page.goto("/biblia/genesis/1");
    await expect(page.locator(".chapterNav a[rel=prev]")).toHaveCount(0);

    await page.goto("/biblia/exodo/1");
    const previous = page.locator(".chapterNav a[rel=prev]");
    await expect(previous).toContainText("Gênesis");
    await previous.click();
    await expect(page).toHaveURL(/\/biblia\/genesis\/\d+$/);
    expect(page.url()).not.toMatch(/\/genesis\/1$/);
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

  test("barra de seleção, menu e painéis cabem na tela", async ({ page }) => {
    await page.goto("/biblia/joao/3");

    await selectVerses(page, [0, 1]);
    const bar = selectionBar(page);
    await expect(bar).toBeVisible();
    await expect(bar).toBeInViewport();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await bar.getByRole("button", { name: /^Aplicar/ }).click();
    await expect(bar.getByRole("button", { name: "Amarelo", exact: true })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    await bar.getByRole("button", { name: /Comparar traduções/ }).click();
    await expect(page.getByRole("dialog", { name: "Comparar traduções" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");

    // No celular o cabeçalho precisa manter as duas ações alcançáveis: marcar o
    // capítulo como lido e abrir as configurações de leitura.
    await expect(page.getByRole("button", { name: /como lido/ })).toBeVisible();
    await expect(settingsTrigger(page)).toBeVisible();

    await settingsTrigger(page).click();
    await expect(settingsDialog(page)).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });

  test("o seletor de livro e capítulo funciona no mobile", async ({ page }) => {
    await page.goto("/biblia/genesis/1");
    await page.locator(".readerPick > button").first().click();
    await expect(page.getByRole("dialog", { name: "Escolher livro" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    // Os 66 livros cabem em uma área própria: o gesto vertical não depende da
    // rolagem da página bloqueada pelo modal.
    const books = page.getByRole("list", { name: "Livros disponíveis" });
    expect(await books.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      return element.scrollTop > 0;
    })).toBe(true);

    await page
      .getByRole("dialog", { name: "Escolher livro" })
      .getByRole("button", { name: /Salmos/ })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: "Escolher capítulo" })).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  });
});
