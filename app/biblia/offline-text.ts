import type { OfflineFailureReason } from "../../src/domain/offline/package";

/**
 * Textos visíveis dos controles de Bíblia offline.
 *
 * Vivem fora do `.tsx` pelo mesmo motivo dos textos do painel lexical: o
 * `tsconfig` do Next usa `jsx: "preserve"`, o vitest não parseia JSX com essa
 * configuração, e texto de tela sem teste é texto que ninguém confere. Aqui são
 * funções puras, testadas em `tests/client/offline-text.test.ts`.
 */

/**
 * Mensagem de cada recusa.
 *
 * Cada motivo tem texto próprio porque levam a ações diferentes: tentar de
 * novo, liberar espaço, atualizar o aplicativo ou desconfiar da rede. Dizer
 * "erro ao baixar" nos quatro casos empurraria a pessoa a repetir o download
 * que vai falhar igual.
 */
export function offlineFailureMessage(reason: OfflineFailureReason): string {
  switch (reason) {
    case "source_unreachable":
      return "O servidor não respondeu. O download continua de onde parou quando a conexão voltar.";
    case "storage_full":
      return "Não há espaço suficiente neste aparelho. Libere espaço e tente de novo; o pacote que já estava instalado continua intacto.";
    case "hash_mismatch":
    case "size_mismatch":
    case "file_invalid":
    case "file_unexpected_book":
    case "file_version_mismatch":
      return "Um dos arquivos recebidos não corresponde ao que o pacote declara, então nada foi gravado. Tente de novo mais tarde; se persistir, a rede ou um intermediário está alterando a resposta.";
    case "manifest_invalid":
      return "A descrição do pacote veio incompleta ou inconsistente, e por isso nada foi baixado.";
    case "manifest_schema_unsupported":
      return "O pacote publicado usa um formato mais novo que esta versão do aplicativo. Atualize o aplicativo para baixar a Bíblia.";
    case "size_over_budget":
      return "O pacote anunciado é maior do que o limite aceito, o que não deveria acontecer. Nada foi baixado.";
    case "incomplete":
      return "O download terminou incompleto, então o pacote não foi ativado. A próxima tentativa continua de onde parou.";
    case "consent_absent":
      return "O download da Bíblia não está ativado neste aparelho.";
    case "consent_revoked":
      // Não é erro: é a remoção funcionando. A mensagem evita que a pessoa
      // ache que a remoção falhou ou que precisa tentar de novo.
      return "O pacote foi removido durante o download, então nada foi ativado. A remoção valeu.";
    case "preference_changed":
      // Também não é erro do app: é duas abas discordando. O que a mensagem
      // precisa garantir é que a pessoa não fique achando que removeu quando
      // nada foi apagado — por isso diz o que **não** aconteceu.
      return "A configuração do download foi alterada em outra aba ao mesmo tempo, então nada foi apagado nem ativado aqui. Recarregue esta página para ver o estado atual e tente de novo.";
    case "not_installed":
      return "Não há pacote instalado neste aparelho.";
    case "chapter_absent":
      return "Este capítulo não está no pacote salvo.";
    case "locked":
      return "Outra aba já está baixando a Bíblia. Acompanhe por lá; nada é baixado duas vezes.";
    case "aborted":
      return "O download foi interrompido. Nada foi ativado, e o pacote anterior continua valendo.";
  }
}

/**
 * Aviso sobre dados móveis.
 *
 * `saveData` e `effectiveType` são **dicas** do navegador, não verdade sobre o
 * plano de quem lê: variam por navegador, faltam no iOS e erram em Wi-Fi lento.
 * Por isso o aviso é informativo e o botão continua disponível — tratar a dica
 * como bloqueio impediria o download de quem está em Wi-Fi e quer baixar.
 */
export function dataWarning(hint: { readonly saveData?: boolean; readonly effectiveType?: string } | null): string | null {
  if (!hint) return null;
  if (hint.saveData === true) {
    return "Este navegador está com economia de dados ligada. O download é grande para rede móvel; se preferir, espere o Wi-Fi.";
  }
  if (hint.effectiveType === "slow-2g" || hint.effectiveType === "2g" || hint.effectiveType === "3g") {
    return "A conexão parece lenta. O download pode demorar e continua de onde parar.";
  }
  return null;
}

/**
 * Frase de tamanho mostrada antes de baixar.
 *
 * Diz os dois números porque eles são diferentes e os dois importam: o que
 * atravessa a rede e o que fica ocupado no aparelho. O segundo é apresentado
 * como estimativa — depende do navegador, e a medição desta plataforma foi
 * feita no Chrome, não em todos.
 */
export function sizeSentence(downloadBytes: number, storageEstimateBytes: number): string {
  const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1).replace(".", ",")} MB`;
  return `Download de ${mb(downloadBytes)} de texto. No aparelho, a ocupação medida fica em torno de ${mb(storageEstimateBytes)} — é estimativa, porque varia com o navegador.`;
}

/**
 * Proporção medida entre o que o pacote declara e o que o IndexedDB ocupou de
 * fato: 3.574.046 bytes para 4.147.636 de texto, no Chrome em 25/11/2026,
 * origem limpa. O Chrome comprime os valores, por isso é menor que o texto.
 * Não é promessa para outros navegadores; é o único número medido que existe.
 */
export const MEASURED_STORAGE_RATIO = 3574046 / 4147636;

export function estimateStorageBytes(downloadBytes: number): number {
  return Math.round(downloadBytes * MEASURED_STORAGE_RATIO);
}

export function describeInstallation(version: string, installedAt: number, chapters: number): string {
  const data = new Date(installedAt).toLocaleDateString("pt-BR");
  return `${chapters} capítulos salvos em ${data} · versão ${version.slice(0, 12)}`;
}

export function progressSentence(booksDone: number, booksTotal: number, bytesDone: number, bytesTotal: number): string {
  const porcento = bytesTotal > 0 ? Math.round((bytesDone / bytesTotal) * 100) : 0;
  return `${porcento}% · ${booksDone} de ${booksTotal} livros`;
}

/**
 * Data da versão da fonte, para a linha de crédito.
 *
 * A licença CC BY pede a indicação da versão, e a Bíblia Livre é declarada
 * pelos próprios autores como trabalho em andamento — então "fevereiro de
 * 2018", que é a data de copyright e o que a atribuição sozinha diz, não
 * identifica a cópia. O que identifica é a assinatura da fonte, que o
 * manifesto já carrega em `sourceSignedAt` e que até aqui não chegava à tela.
 *
 * Aceita o formato do manifesto (`2026-10-30 05:50`) e devolve só o dia: hora
 * de assinatura não diz nada a quem lê e sugere precisão que não importa.
 * Formato não reconhecido volta como veio, em vez de desaparecer.
 */
export function sourceVersionSentence(sourceSignedAt: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(sourceSignedAt.trim());
  const quando = match ? `${match[3]}/${match[2]}/${match[1]}` : sourceSignedAt.trim();
  return `Versão desta cópia: fonte assinada em ${quando}.`;
}
