/**
 * Novidades e estado da plataforma mostrados no painel de início (tarefa C15).
 *
 * Lista editorial mantida à mão, não um feed: cada entrada descreve algo que já
 * está no aplicativo ou algo que está declaradamente indisponível, e pode ser
 * conferida em `docs/IMPLEMENTATION_LOG.md`. Nenhuma entrada promete data,
 * licença, preço, conteúdo premium ou recurso que não exista.
 *
 * `status` separa o que funciona hoje do que depende de uma decisão externa
 * (licenciamento de tradução, autenticação, fontes originais).
 */

export type PlatformUpdateStatus = "disponivel" | "indisponivel";

export interface PlatformUpdate {
  readonly id: string;
  /** Data da entrada no registro de implementação, em ISO. */
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly status: PlatformUpdateStatus;
}

export const platformUpdates: readonly PlatformUpdate[] = [
  {
    id: "leitor-corpus-blivre",
    date: "2026-11-17",
    title: "Leitura de qualquer livro e capítulo da Bíblia Livre",
    summary:
      "O leitor abre o capítulo diretamente do corpus publicado da tradução Bíblia Livre (BLIVRE), com atribuição da tradução na própria página.",
    status: "disponivel",
  },
  {
    id: "selecao-multipla",
    date: "2026-11-17",
    title: "Seleção de vários versículos, destaque por cor e nota",
    summary:
      "Tocar no texto marca e desmarca versículos; a barra de ações aparece só com seleção e oferece quatro cores de destaque e nota ligada à seleção que a originou.",
    status: "disponivel",
  },
  {
    id: "marcas-locais",
    date: "2026-11-17",
    title: "Notas, destaques e capítulos lidos ficam nesta sessão",
    summary:
      "Sem conta, as marcas vivem apenas no navegador e nesta sessão. A sincronização entre dispositivos depende da autenticação, que ainda não existe.",
    status: "indisponivel",
  },
  {
    id: "outras-traducoes",
    date: "2026-11-17",
    title: "Outras traduções seguem em licenciamento",
    summary:
      "Comparar traduções exibe NVI, NTLH e Almeida como “em licenciamento”, e o painel de idiomas originais continua sem texto grego ou hebraico aprovado.",
    status: "indisponivel",
  },
];
