import { describe, expect, it } from "vitest";

import {
  MEASURED_STORAGE_RATIO,
  dataWarning,
  describeInstallation,
  estimateStorageBytes,
  offlineFailureMessage,
  sourceVersionSentence,
  progressSentence,
  sizeSentence,
} from "../../app/biblia/offline-text";
import type { OfflineFailureReason } from "../../src/domain/offline/package";

const TODOS: readonly OfflineFailureReason[] = [
  "manifest_invalid",
  "manifest_schema_unsupported",
  "file_invalid",
  "file_unexpected_book",
  "file_version_mismatch",
  "hash_mismatch",
  "size_mismatch",
  "size_over_budget",
  "incomplete",
  "not_installed",
  "chapter_absent",
  "consent_absent",
  "source_unreachable",
  "storage_full",
  "locked",
  "aborted",
];

describe("mensagem de cada recusa", () => {
  it("tem texto para todo motivo, porque falha sem mensagem vira 'erro'", () => {
    for (const reason of TODOS) {
      expect(offlineFailureMessage(reason)).toMatch(/\S/u);
    }
  });

  it("distingue rede, espaço e resposta adulterada", () => {
    // São três ações diferentes: esperar, liberar espaço e desconfiar.
    expect(offlineFailureMessage("source_unreachable")).toMatch(/conexão voltar/u);
    expect(offlineFailureMessage("storage_full")).toMatch(/espaço/u);
    expect(offlineFailureMessage("hash_mismatch")).toMatch(/não corresponde/u);

    const textos = new Set(
      (["source_unreachable", "storage_full", "hash_mismatch"] as const).map(offlineFailureMessage),
    );
    expect(textos.size).toBe(3);
  });

  it("diz que o pacote anterior continua intacto quando é verdade", () => {
    expect(offlineFailureMessage("storage_full")).toMatch(/continua intacto/u);
    expect(offlineFailureMessage("aborted")).toMatch(/continua valendo/u);
  });

  it("manda atualizar o aplicativo quando o formato é mais novo", () => {
    expect(offlineFailureMessage("manifest_schema_unsupported")).toMatch(/Atualize o aplicativo/u);
  });

  it("nenhuma mensagem culpa a pessoa nem promete o que não houve", () => {
    for (const reason of TODOS) {
      const texto = offlineFailureMessage(reason);
      expect(texto).not.toMatch(/você errou|falha sua/iu);
      expect(texto).not.toMatch(/baixad[oa] com sucesso/iu);
    }
  });
});

describe("aviso de dados móveis", () => {
  it("avisa com economia de dados ligada, sem bloquear", () => {
    const texto = dataWarning({ saveData: true });
    expect(texto).toMatch(/economia de dados/u);
    // É aviso: não diz que não pode baixar.
    expect(texto).not.toMatch(/não é possível|bloquead/iu);
  });

  it("avisa em conexão lenta e silencia em conexão boa", () => {
    expect(dataWarning({ effectiveType: "2g" })).toMatch(/lenta/u);
    expect(dataWarning({ effectiveType: "4g" })).toBeNull();
    expect(dataWarning({ saveData: false, effectiveType: "4g" })).toBeNull();
  });

  it("sem dica do navegador, não inventa aviso", () => {
    // `connection` não existe no iOS; ausência de dica não é ausência de Wi-Fi.
    expect(dataWarning(null)).toBeNull();
    expect(dataWarning({})).toBeNull();
  });
});

describe("tamanho declarado antes de baixar", () => {
  it("diz os dois números e marca o segundo como estimativa", () => {
    const texto = sizeSentence(4165893, estimateStorageBytes(4165893));
    expect(texto).toMatch(/Download de 4,0 MB/u);
    expect(texto).toMatch(/estimativa/u);
    expect(texto).toMatch(/varia com o navegador/u);
  });

  it("a proporção medida vem da medição real, e é menor que o texto", () => {
    // Chrome comprime os valores do IndexedDB: 3.574.046 para 4.147.636 bytes.
    expect(MEASURED_STORAGE_RATIO).toBeLessThan(1);
    expect(MEASURED_STORAGE_RATIO).toBeGreaterThan(0.8);
    expect(estimateStorageBytes(4147636)).toBe(3574046);
  });
});

describe("descrição do que está instalado", () => {
  it("mostra capítulos, data e um prefixo da versão", () => {
    const texto = describeInstallation("58848c94cb743af0b2f0e03a1b31fb7086651ff414ca91bc291d5d90adb27169", Date.UTC(2026, 10, 25, 15), 1189);
    expect(texto).toMatch(/1189 capítulos/u);
    expect(texto).toMatch(/58848c94cb74/u);
    // A versão inteira tem 64 dígitos e não cabe na tela; o prefixo basta para
    // comparar com o relatório de publicação.
    expect(texto).not.toMatch(/adb27169/u);
  });
});

describe("frase de progresso", () => {
  it("conta livros e porcentagem de bytes", () => {
    expect(progressSentence(0, 66, 0, 4147636)).toBe("0% · 0 de 66 livros");
    expect(progressSentence(33, 66, 2073818, 4147636)).toBe("50% · 33 de 66 livros");
    expect(progressSentence(66, 66, 4147636, 4147636)).toBe("100% · 66 de 66 livros");
  });

  it("não divide por zero", () => {
    expect(progressSentence(0, 0, 0, 0)).toBe("0% · 0 de 0 livros");
  });
});

describe("data da versão da fonte", () => {
  it("mostra o dia da assinatura, sem a hora", () => {
    // A licença pede indicação de versão, e a atribuição sozinha só diz
    // "fevereiro de 2018" — data do copyright, não desta cópia.
    expect(sourceVersionSentence("2026-10-30 05:50")).toBe(
      "Versão desta cópia: fonte assinada em 30/10/2026.",
    );
  });

  it("formato inesperado volta como veio, em vez de desaparecer", () => {
    expect(sourceVersionSentence("outubro de 2026")).toBe(
      "Versão desta cópia: fonte assinada em outubro de 2026.",
    );
  });
});
