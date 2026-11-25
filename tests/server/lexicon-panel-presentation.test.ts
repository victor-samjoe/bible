import { describe, expect, it } from "vitest";
import {
  acceptionCount,
  lexiconFallbackMessage,
  readableSenseNote,
  readableSourceGloss,
  reviewLabel,
} from "../../app/biblia/lexicon-panel-text";

/**
 * Textos visíveis do painel lexical.
 *
 * Eles vivem fora do `.tsx` porque o `tsconfig` do Next usa `jsx: "preserve"`,
 * e o vitest não parseia JSX com essa configuração — mudar a config afetaria
 * toda a suíte. A alternativa era deixar texto de tela sem teste nenhum.
 *
 * O que depende de DOM — foco por teclado, `aria-pressed`, abertura da árvore,
 * largura em telefone — foi conferido no navegador e está registrado em
 * `tasks/product/LEXICON-SHARD-GEN1-atualizacao.md`.
 */
describe("rótulo do estado de revisão", () => {
  it("está em português correto, com acentos", () => {
    // Estavam sem acento no painel: "traducao aprovada", "rascunho nao revisado".
    expect(reviewLabel.approved).toBe("tradução aprovada");
    expect(reviewLabel.unreviewed_draft).toBe("rascunho não revisado");
    expect(reviewLabel.editorial_reviewed).toBe("revisado");
    expect(reviewLabel.source_text).toBe("texto da fonte");
  });

  it("tem rótulo para todo estado, porque rascunho sem rótulo é o risco", () => {
    for (const state of ["editorial_reviewed", "approved", "unreviewed_draft", "source_text"] as const) {
      expect(reviewLabel[state]).toMatch(/\S/u);
    }
  });

  it("distingue tradução aprovada de rascunho em palavras, não só em cor", () => {
    // Quem não distingue as cores do selo depende do texto.
    expect(reviewLabel.approved).not.toBe(reviewLabel.unreviewed_draft);
    expect(reviewLabel.unreviewed_draft).toMatch(/rascunho/u);
    expect(reviewLabel.source_text).not.toMatch(/revisad/u);
  });
});

describe("contagem de acepções", () => {
  it("usa plural de verdade, não `acepção(ões)`", () => {
    expect(acceptionCount(1)).toBe("1 acepção");
    expect(acceptionCount(4)).toBe("4 acepções");
    expect(acceptionCount(32)).toBe("32 acepções");
  });

  it("zero é plural em português", () => {
    expect(acceptionCount(0)).toBe("0 acepções");
  });
});

describe("mensagem quando a palavra não tem análise lexical", () => {
  it("distingue consulta em voo, consulta falhada e pendência de revisão", () => {
    // Os três casos não podem compartilhar texto: dizer "aguarda revisão
    // editorial" enquanto a consulta está em voo, ou depois de ela falhar,
    // afirma um estado editorial que ninguém verificou.
    expect(lexiconFallbackMessage("loading")).toMatch(/Consultando/u);
    expect(lexiconFallbackMessage("failed")).toMatch(/não respondeu/u);
    expect(lexiconFallbackMessage("answered")).toMatch(/aguarda revisão editorial/u);

    const textos = new Set(
      (["loading", "failed", "answered"] as const).map((state) => lexiconFallbackMessage(state)),
    );
    expect(textos.size).toBe(3);
  });

  it("nem o carregamento nem a falha afirmam estado editorial", () => {
    expect(lexiconFallbackMessage("loading")).not.toMatch(/revisão editorial/u);
    expect(lexiconFallbackMessage("failed")).not.toMatch(/revisão editorial/u);
  });

  it("a falha diz que a forma e a morfologia não dependem do índice", () => {
    // Para o leitor não concluir que o texto original também caiu: ele vem da
    // edição aprovada, por outra consulta.
    expect(lexiconFallbackMessage("failed")).toMatch(/não dependem dela/u);
  });
});

describe("glossa da fonte legível", () => {
  it("troca os pontos do dataset por espaços, sem colar palavras", () => {
    expect(readableSourceGloss("the.people")).toBe("the people");
    expect(readableSourceGloss("[estava].sobre")).toBe("[estava] sobre");
    expect(readableSourceGloss("de.as.águas")).toBe("de as águas");
  });

  it("não deixa espaço sobrando nem nas pontas nem no meio", () => {
    expect(readableSourceGloss("  in..beginning  ")).toBe("in beginning");
    expect(readableSourceGloss("a__b")).toBe("a b");
  });
});

describe("nota da acepção do BDB", () => {
  it("some quando é só separador, porque não carrega informação", () => {
    // No XML as <def> são separadas por vírgulas soltas, e o parser as recolhe
    // na nota. Na tela isso virava "come to pass , , ,".
    expect(readableSenseNote(",")).toBeNull();
    expect(readableSenseNote(", , ,")).toBeNull();
    expect(readableSenseNote("  ")).toBeNull();
    expect(readableSenseNote(null)).toBeNull();
  });

  it("corta o lixo do fim sem tocar no conteúdo", () => {
    expect(readableSenseNote("esp. & very oft., ,")).toBe("esp. & very oft.");
    expect(readableSenseNote("abs., in lively narrative, , ,")).toBe("abs., in lively narrative");
  });

  it("preserva a nota legítima inteira, inclusive a pontuação interna", () => {
    expect(readableSenseNote("וַיְהִי that, most often (c. 292 t.)")).toBe(
      "וַיְהִי that, most often (c. 292 t.)",
    );
    expect(readableSenseNote("sq. prep.")).toBe("sq. prep.");
    // O ponto final de uma abreviação não é separador e fica.
    expect(readableSenseNote("of time.")).toBe("of time.");
  });
});
