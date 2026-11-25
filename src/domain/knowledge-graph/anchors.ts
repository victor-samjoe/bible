/**
 * Âncora canônica de passagem (KNOWLEDGE-GRAPH-001, fila A2).
 *
 * A unidade central da árvore não é página, comentário nem resposta de agente:
 * é a passagem, identificada por **cânon + sistema de versificação + livro +
 * capítulo + versículo inicial/final** (`docs/VERSE_KNOWLEDGE_GRAPH.md` §1).
 *
 * Por que os dois primeiros campos existem, e não são enfeite:
 *
 * 1. **Uma tradução não é identificador universal.** Vulgata, texto hebraico e
 *    BLIVRE segmentam e numeram de forma diferente. `MIC 5:2` em português é
 *    `MIC 5:1` na numeração hebraica — `src/domain/original-versification.ts`
 *    já carrega esse deslocamento dentro do leitor. Gravar "Miqueias 5:2" sem
 *    dizer de qual sistema é equivale a gravar duas passagens com um nome só.
 * 2. **Ligar sistemas exige mapa documentado, nunca igualdade de número.**
 *    `mapAnchor` recusa a travessia sem ponte registrada em vez de supor que o
 *    mesmo número aponta para o mesmo texto. É a mesma regra que a frente de
 *    alinhamento aplica a palavras: posição não é equivalência.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco.
 */

import { z } from "zod";
import { CANON, canonBook } from "../lexicon/canon";
import { isoDate, issuesOf, optionalText, requiredText, stableId } from "./primitives";

export type Testament = "ot" | "nt";

export const CANON_IDS = ["protestante", "tanak", "catolico-romano", "septuaginta"] as const;
export type CanonId = (typeof CANON_IDS)[number];
export const canonId = z.enum(CANON_IDS);

/**
 * `approved` = cânon em uso no produto. `pending_approval` = pode ancorar
 * evidência e testemunho em preparação, mas nada nele é publicável. É assim que
 * a regra da fila C29 — Vulgata e Septuaginta só depois de edição, licença e
 * versificação aprovadas — fica no contrato, e não apenas na documentação.
 */
export type CanonStatus = "approved" | "pending_approval";

export type CanonDefinition = {
  readonly id: CanonId;
  readonly label: string;
  readonly status: CanonStatus;
  /** Ordem de exibição e de ordenação: pertencimento e ordem são declarados juntos. */
  readonly bookOrder: readonly string[];
  readonly note: string;
};

const PROTESTANT_ORDER: readonly string[] = CANON.map((book) => book.code);
const PROTESTANT_OT: readonly string[] = CANON.filter((book) => book.testament === "ot").map((book) => book.code);
const PROTESTANT_NT: readonly string[] = CANON.filter((book) => book.testament === "nt").map((book) => book.code);

/**
 * Ordem do Tanak: Torá, Profetas, Escritos. São os mesmos 39 livros do Antigo
 * Testamento protestante em outra sequência e outra divisão. Declarada aqui
 * porque ordenar uma consulta hebraica pela ordem cristã produz uma lista que
 * nenhuma edição hebraica reconhece.
 */
const TANAK_ORDER: readonly string[] = [
  "GEN", "EXO", "LEV", "NUM", "DEU",
  "JOS", "JDG", "1SA", "2SA", "1KI", "2KI",
  "ISA", "JER", "EZK",
  "HOS", "JOL", "AMO", "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL",
  "PSA", "PRO", "JOB", "SNG", "RUT", "LAM", "ECC", "EST", "DAN", "EZR", "NEH", "1CH", "2CH",
];

/**
 * Códigos USFM dos livros deuterocanônicos. Entram como **membros declarados**,
 * em ordem provisória, porque composição e ordem definitivas dependem da edição
 * que o operador aprovar. Nenhum texto é importado por este arquivo: isto é
 * lista de identificadores, não corpus.
 */
const DEUTEROCANONICAL_LATIN: readonly string[] = ["TOB", "JDT", "ESG", "WIS", "SIR", "BAR", "LJE", "DAG", "1MA", "2MA"];
const DEUTEROCANONICAL_GREEK: readonly string[] = [...DEUTEROCANONICAL_LATIN, "1ES", "2ES", "MAN", "PS2", "3MA", "ODA", "PSS"];

export const CANONS: readonly CanonDefinition[] = [
  {
    id: "protestante",
    label: "Protestante (66 livros)",
    status: "approved",
    bookOrder: PROTESTANT_ORDER,
    note: "Cânon servido pelo leitor; é o da BLIVRE já publicada.",
  },
  {
    id: "tanak",
    label: "Tanak (ordem hebraica)",
    status: "approved",
    bookOrder: TANAK_ORDER,
    note: "Mesmo conjunto do Antigo Testamento protestante, na ordem e divisão hebraicas.",
  },
  {
    id: "catolico-romano",
    label: "Católico romano (com deuterocanônicos)",
    status: "pending_approval",
    bookOrder: [...PROTESTANT_OT, ...DEUTEROCANONICAL_LATIN, ...PROTESTANT_NT],
    note: "Pertencimento declarado para preparar a Vulgata; composição e ordem finais dependem da edição aprovada.",
  },
  {
    id: "septuaginta",
    label: "Septuaginta (ordem grega)",
    status: "pending_approval",
    bookOrder: [...PROTESTANT_OT, ...DEUTEROCANONICAL_GREEK],
    note: "Pertencimento declarado para preparar a LXX; ordem definitiva depende da edição aprovada.",
  },
];

const CANON_BY_ID: ReadonlyMap<CanonId, CanonDefinition> = new Map(CANONS.map((definition) => [definition.id, definition]));

export function canonDefinition(id: CanonId): CanonDefinition {
  const found = CANON_BY_ID.get(id);
  if (!found) throw new Error(`Cânon desconhecido: ${id}`);
  return found;
}

export function canonHasBook(id: CanonId, book: string): boolean {
  return canonDefinition(id).bookOrder.includes(book);
}

/** Posição do livro na ordem declarada do cânon, ou `-1` quando não pertence. */
export function bookOrdinal(id: CanonId, book: string): number {
  return canonDefinition(id).bookOrder.indexOf(book);
}

export const VERSIFICATION_IDS = ["blivre-pt", "wlc-mt", "sblgnt", "vulgata-clementina", "lxx-rahlfs"] as const;
export type VersificationId = (typeof VERSIFICATION_IDS)[number];
export const versificationId = z.enum(VERSIFICATION_IDS);

export type VersificationSystem = {
  readonly id: VersificationId;
  readonly label: string;
  readonly canon: CanonId;
  /** Parte do cânon que o sistema numera. */
  readonly scope: "ot" | "nt" | "full";
  readonly status: CanonStatus;
  readonly note: string;
};

export const VERSIFICATION_SYSTEMS: readonly VersificationSystem[] = [
  {
    id: "blivre-pt",
    label: "BLIVRE (português)",
    canon: "protestante",
    scope: "full",
    status: "approved",
    note: "Numeração exibida pelo leitor; é o sistema de entrada das consultas do usuário.",
  },
  {
    id: "wlc-mt",
    label: "Texto massorético (WLC/MorphHB)",
    canon: "tanak",
    scope: "ot",
    status: "approved",
    note: "Numeração impressa no hebraico; difere da portuguesa em Miqueias 5, em salmos com título e em outros trechos documentados.",
  },
  {
    id: "sblgnt",
    label: "SBLGNT (grego)",
    canon: "protestante",
    scope: "nt",
    status: "approved",
    note: "Numeração do Novo Testamento grego da edição SBL.",
  },
  {
    id: "vulgata-clementina",
    label: "Vulgata Clementina",
    canon: "catolico-romano",
    scope: "full",
    status: "pending_approval",
    note: "Declarada para preparação; exige edição, licença e mapa de versificação aprovados (fila C29).",
  },
  {
    id: "lxx-rahlfs",
    label: "Septuaginta (edição Rahlfs)",
    canon: "septuaginta",
    scope: "ot",
    status: "pending_approval",
    note: "Declarada para preparação; exige edição, licença e mapa de versificação aprovados (fila C29).",
  },
];

const SYSTEM_BY_ID: ReadonlyMap<VersificationId, VersificationSystem> = new Map(
  VERSIFICATION_SYSTEMS.map((system) => [system.id, system]),
);

export function versificationSystem(id: VersificationId): VersificationSystem {
  const found = SYSTEM_BY_ID.get(id);
  if (!found) throw new Error(`Sistema de versificação desconhecido: ${id}`);
  return found;
}

/** Sistemas que podem sustentar registro publicável. */
export function approvedVersifications(): readonly VersificationSystem[] {
  return VERSIFICATION_SYSTEMS.filter((system) => system.status === "approved");
}

/**
 * Testamento do livro segundo o cânon protestante, que é o único com divisão de
 * testamento já declarada no repositório. `null` para deuterocanônico, e nesse
 * caso o escopo do sistema não é conferido — não há decisão registrada sobre
 * onde esses livros entram.
 */
function testamentOf(book: string): Testament | null {
  return canonBook(book)?.testament ?? null;
}

export const PassageAnchorSchema = z
  .strictObject({
    canon: canonId,
    versification: versificationId,
    /** Código USFM, como já usado no índice lexical (`GEN`, `MIC`, `JHN`). */
    book: z.string().trim().regex(/^[A-Z0-9]{3}$/u, "Use código USFM de três caracteres, como GEN"),
    chapter: z.number().int().min(1).max(151),
    verseStart: z.number().int().min(1).max(176),
    verseEnd: z.number().int().min(1).max(176),
  })
  .check((ctx) => {
    const anchor = ctx.value;
    if (anchor.verseEnd < anchor.verseStart) {
      ctx.issues.push({ code: "custom", input: anchor, path: ["verseEnd"], message: "O versículo final não pode ser menor que o inicial" });
    }
    if (!canonHasBook(anchor.canon, anchor.book)) {
      ctx.issues.push({ code: "custom", input: anchor, path: ["book"], message: `Livro ${anchor.book} não pertence ao cânon ${anchor.canon}` });
    }
    const system = SYSTEM_BY_ID.get(anchor.versification);
    if (system) {
      if (system.canon !== anchor.canon) {
        ctx.issues.push({ code: "custom", input: anchor, path: ["versification"], message: `O sistema ${system.id} numera o cânon ${system.canon}, não ${anchor.canon}` });
      }
      const testament = testamentOf(anchor.book);
      if (system.scope !== "full" && testament !== null && testament !== system.scope) {
        ctx.issues.push({ code: "custom", input: anchor, path: ["versification"], message: `O sistema ${system.id} cobre apenas ${system.scope === "ot" ? "o Antigo" : "o Novo"} Testamento` });
      }
    }
  });

export type PassageAnchor = z.infer<typeof PassageAnchorSchema>;

export function parseAnchorRecord(
  input: unknown,
): { readonly ok: true; readonly anchor: PassageAnchor } | { readonly ok: false; readonly errors: readonly string[] } {
  const parsed = PassageAnchorSchema.safeParse(input);
  return parsed.success ? { ok: true, anchor: parsed.data } : { ok: false, errors: issuesOf(parsed.error, "anchor") };
}

/**
 * Chave estável e citável: `protestante/blivre-pt/GEN 1:1`. Cânon e sistema vêm
 * na frente justamente para que duas numerações da mesma passagem não colapsem
 * na mesma chave dentro de um índice, de um cache ou de uma URL.
 */
export function anchorKey(anchor: PassageAnchor): string {
  const range = anchor.verseStart === anchor.verseEnd ? `${anchor.verseStart}` : `${anchor.verseStart}-${anchor.verseEnd}`;
  return `${anchor.canon}/${anchor.versification}/${anchor.book} ${anchor.chapter}:${range}`;
}

const KEY_PATTERN = /^([a-z-]+)\/([a-z0-9-]+)\/([A-Z0-9]{3}) (\d+):(\d+)(?:-(\d+))?$/u;

export function parseAnchorKey(
  key: string,
): { readonly ok: true; readonly anchor: PassageAnchor } | { readonly ok: false; readonly errors: readonly string[] } {
  const match = KEY_PATTERN.exec(key.trim());
  if (!match) return { ok: false, errors: ["anchor: chave fora do formato canon/versificacao/LIVRO capitulo:versiculo"] };
  const [, canon, versification, book, chapter, verseStart, verseEnd] = match;
  return parseAnchorRecord({
    canon,
    versification,
    book,
    chapter: Number(chapter),
    verseStart: Number(verseStart),
    verseEnd: verseEnd === undefined ? Number(verseStart) : Number(verseEnd),
  });
}

/** Referência exibível no mesmo formato do índice lexical (`GEN 1:1`). */
export function canonicalRef(anchor: PassageAnchor): string {
  return anchor.verseStart === anchor.verseEnd
    ? `${anchor.book} ${anchor.chapter}:${anchor.verseStart}`
    : `${anchor.book} ${anchor.chapter}:${anchor.verseStart}-${anchor.verseEnd}`;
}

export function sameSystem(left: PassageAnchor, right: PassageAnchor): boolean {
  return left.canon === right.canon && left.versification === right.versification;
}

/** Interseção de versículos. Só tem sentido dentro do mesmo sistema. */
export function anchorsOverlap(left: PassageAnchor, right: PassageAnchor): boolean {
  if (!sameSystem(left, right) || left.book !== right.book || left.chapter !== right.chapter) return false;
  return left.verseStart <= right.verseEnd && right.verseStart <= left.verseEnd;
}

export function anchorContains(outer: PassageAnchor, inner: PassageAnchor): boolean {
  if (!sameSystem(outer, inner) || outer.book !== inner.book || outer.chapter !== inner.chapter) return false;
  return outer.verseStart <= inner.verseStart && inner.verseEnd <= outer.verseEnd;
}

/** Ordenação canônica dentro de um cânon; entre cânones, pelo identificador. */
export function compareAnchors(left: PassageAnchor, right: PassageAnchor): number {
  if (left.canon !== right.canon) return left.canon < right.canon ? -1 : 1;
  const ordinalDelta = bookOrdinal(left.canon, left.book) - bookOrdinal(right.canon, right.book);
  if (ordinalDelta !== 0) return ordinalDelta;
  if (left.chapter !== right.chapter) return left.chapter - right.chapter;
  if (left.verseStart !== right.verseStart) return left.verseStart - right.verseStart;
  if (left.verseEnd !== right.verseEnd) return left.verseEnd - right.verseEnd;
  return left.versification < right.versification ? -1 : left.versification > right.versification ? 1 : 0;
}

/** Uma âncora é publicável só se cânon e sistema estiverem aprovados. */
export function anchorIsPublishable(anchor: PassageAnchor): boolean {
  return canonDefinition(anchor.canon).status === "approved" && versificationSystem(anchor.versification).status === "approved";
}

export const VERSIFICATION_RELATIONS = ["mesmo_texto", "deslocado", "dividido", "unido", "ausente"] as const;
export type VersificationRelation = (typeof VERSIFICATION_RELATIONS)[number];

/**
 * Ponte documentada entre dois sistemas de versificação.
 *
 * `documentation` não é opcional: ponte sem fonte é palpite com aparência de
 * dado. `ausente` é relação legítima — dizer que a passagem não existe no outro
 * sistema é informação, e é muito melhor do que apontar para um vizinho.
 */
export const VersificationBridgeSchema = z
  .strictObject({
    id: stableId,
    from: PassageAnchorSchema,
    to: PassageAnchorSchema.nullable(),
    relation: z.enum(VERSIFICATION_RELATIONS),
    documentation: z.strictObject({
      reference: requiredText,
      documentedBy: requiredText,
      documentedAt: isoDate,
      sourceEditionId: stableId.nullable().default(null),
    }),
    note: optionalText,
  })
  .check((ctx) => {
    const bridge = ctx.value;
    if (bridge.relation === "ausente") {
      if (bridge.to !== null) {
        ctx.issues.push({ code: "custom", input: bridge, path: ["to"], message: "Relação ausente não pode apontar para uma passagem" });
      }
      return;
    }
    if (bridge.to === null) {
      ctx.issues.push({ code: "custom", input: bridge, path: ["to"], message: `Relação ${bridge.relation} exige a passagem de destino` });
      return;
    }
    if (sameSystem(bridge.from, bridge.to)) {
      ctx.issues.push({ code: "custom", input: bridge, path: ["to"], message: "A ponte precisa ligar sistemas de versificação diferentes" });
    }
  });

export type VersificationBridge = z.infer<typeof VersificationBridgeSchema>;

export type AnchorMapping =
  | {
      readonly ok: true;
      readonly anchors: readonly PassageAnchor[];
      readonly relation: VersificationRelation | "identidade";
      readonly bridgeIds: readonly string[];
    }
  | { readonly ok: false; readonly reason: "sem_ponte"; readonly message: string; readonly bridgeIds: readonly string[] }
  | { readonly ok: false; readonly reason: "ausente"; readonly message: string; readonly bridgeIds: readonly string[] };

/**
 * Traduz a âncora para outro sistema **somente** por ponte registrada.
 *
 * Não existe caminho alternativo. Sem ponte, a resposta é `sem_ponte` e quem
 * chamou decide o que exibir — normalmente "não localizado", nunca o mesmo
 * número em outra numeração. Esse atalho silencioso é exatamente o defeito que
 * o deslocamento de Miqueias 5 já provou existir.
 */
export function mapAnchor(
  anchor: PassageAnchor,
  target: VersificationId,
  bridges: readonly VersificationBridge[],
): AnchorMapping {
  if (anchor.versification === target) {
    return { ok: true, anchors: [anchor], relation: "identidade", bridgeIds: [] };
  }
  const candidates = bridges.filter((bridge) => sameSystem(bridge.from, anchor)
    && bridge.from.book === anchor.book
    && anchorsOverlap(bridge.from, anchor)
    && (bridge.to === null ? bridge.relation === "ausente" : bridge.to.versification === target));
  const usable = candidates.filter((bridge): bridge is VersificationBridge & { to: PassageAnchor } => bridge.to !== null);
  if (usable.length === 0) {
    const absent = candidates.filter((bridge) => bridge.relation === "ausente");
    if (absent.length > 0) {
      return {
        ok: false,
        reason: "ausente",
        message: `A passagem ${anchorKey(anchor)} está registrada como ausente em ${target}`,
        bridgeIds: absent.map((bridge) => bridge.id).sort(),
      };
    }
    return {
      ok: false,
      reason: "sem_ponte",
      message: `Sem mapa de versificação documentado de ${anchor.versification} para ${target}; igualdade de número não é equivalência`,
      bridgeIds: [],
    };
  }
  const first = usable[0] as VersificationBridge & { to: PassageAnchor };
  const relation = usable.length === 1 ? first.relation : "dividido";
  return {
    ok: true,
    anchors: [...usable.map((bridge) => bridge.to)].sort(compareAnchors),
    relation,
    bridgeIds: usable.map((bridge) => bridge.id).sort(),
  };
}

/** Equivalência entre sistemas: idêntica, ou unida por ponte registrada. */
export function anchorsEquivalent(
  left: PassageAnchor,
  right: PassageAnchor,
  bridges: readonly VersificationBridge[],
): boolean {
  if (sameSystem(left, right)) return anchorKey(left) === anchorKey(right);
  const mapped = mapAnchor(left, right.versification, bridges);
  return mapped.ok && mapped.anchors.some((anchor) => anchorsOverlap(anchor, right));
}
