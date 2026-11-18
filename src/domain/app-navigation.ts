/**
 * Áreas do aplicativo e estado de cada uma (tarefa C15). Funções puras: nenhum
 * acesso a React, banco, rede ou armazenamento, para que a navegação lateral, o
 * painel de início e os testes leiam a mesma lista.
 *
 * Regra desta lista: só é `available` a área que tem página publicada no app. O
 * que depende de Auth real (C5/C10) ou de outra frente em andamento (C17) fica
 * `unavailable` com motivo escrito, e a interface mostra o motivo em vez de um
 * link que levaria a 404 ou a uma tela que promete sincronização inexistente.
 *
 * Nada aqui decide produto, licença ou preço: apenas descreve o que existe.
 */

export type AreaAvailability =
  | { readonly kind: "available" }
  | { readonly kind: "unavailable"; readonly reason: string };

export type AppArea = {
  readonly id: string;
  readonly label: string;
  /** Rota pretendida da área. Também é usada como chave de "área ativa". */
  readonly href: string;
  readonly description: string;
  readonly availability: AreaAvailability;
};

const available: AreaAvailability = { kind: "available" };

/**
 * Ordem da fila C15: Início, Bíblia, Materiais, Notas, Estudos, Cursos, Planos
 * e Perfil.
 *
 * `notas` continua indisponível porque depende de Auth Supabase real (C5/C10):
 * não existe `app/notas`, e linkar para lá daria 404. `perfil` passou a
 * disponível quando a frente C17b publicou `app/perfil/page.tsx` — a página
 * existe e é honesta sobre exigir autenticação.
 */
export const appAreas: readonly AppArea[] = [
  {
    id: "inicio",
    label: "Início",
    href: "/inicio",
    description: "Retomar a leitura e ver o que está disponível.",
    availability: available,
  },
  {
    id: "biblia",
    label: "Bíblia",
    href: "/biblia",
    description: "Leitura da Bíblia Livre (BLIVRE) por livro e capítulo.",
    availability: available,
  },
  {
    id: "materiais",
    label: "Materiais",
    href: "/materiais",
    description: "Fichas editoriais de materiais de apoio.",
    availability: available,
  },
  {
    id: "notas",
    label: "Notas",
    href: "/notas",
    description: "Biblioteca de notas e destaques da conta.",
    availability: {
      kind: "unavailable",
      reason:
        "Exige conta autenticada para guardar e sincronizar. Hoje notas e destaques ficam apenas nesta sessão do navegador, dentro do leitor.",
    },
  },
  {
    id: "estudos",
    label: "Estudos",
    href: "/estudos",
    description: "Estudos e análises com fontes declaradas.",
    availability: available,
  },
  {
    id: "cursos",
    label: "Cursos",
    href: "/cursos",
    description: "Estruturas de curso por tema, em preparação editorial.",
    availability: available,
  },
  {
    id: "planos",
    label: "Planos",
    href: "/planos",
    description: "O que é gratuito e o que ainda não tem cobrança definida.",
    availability: available,
  },
  {
    id: "perfil",
    label: "Perfil",
    href: "/perfil",
    // A página existe (frente C17b) e por isso a área é alcançável. Ela não
    // mostra dado pessoal algum: explica que identidade, dispositivos e
    // segurança exigem autenticação, que ainda não existe. A descrição abaixo
    // precisa dizer isso, para o menu não prometer o que a página nega.
    description: "Área pessoal; identidade e segurança exigem autenticação, que ainda não existe.",
    availability: available,
  },
];

export function isAreaAvailable(area: AppArea): boolean {
  return area.availability.kind === "available";
}

/** Motivo da indisponibilidade, ou `null` quando a área está disponível. */
export function unavailableReason(area: AppArea): string | null {
  return area.availability.kind === "unavailable" ? area.availability.reason : null;
}

function normalizePath(pathname: string): string {
  if (typeof pathname !== "string" || pathname.length === 0) return "";
  const withoutQuery = pathname.split(/[?#]/)[0] ?? "";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) return withoutQuery.slice(0, -1);
  return withoutQuery;
}

/**
 * A rota pertence à área? Compara segmento inteiro, então `/biblia` casa com
 * `/biblia/genesis/1` e nunca com `/bibliateca`. A raiz não pertence a nenhuma
 * área: ela redireciona para o leitor.
 */
export function isAreaActive(pathname: string, area: AppArea): boolean {
  const path = normalizePath(pathname);
  if (path.length === 0 || path === "/") return false;
  if (!isAreaAvailable(area)) return false;
  return path === area.href || path.startsWith(`${area.href}/`);
}

/** Área ativa da rota. Em empate, vence o `href` mais específico. */
export function activeAreaOf(
  pathname: string,
  areas: readonly AppArea[] = appAreas,
): AppArea | null {
  let found: AppArea | null = null;
  for (const area of areas) {
    if (!isAreaActive(pathname, area)) continue;
    if (found === null || area.href.length > found.href.length) found = area;
  }
  return found;
}
