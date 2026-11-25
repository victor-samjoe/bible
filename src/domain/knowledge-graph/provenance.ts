/**
 * Fonte, edição, ativo armazenado, direitos e localização reproduzível
 * (KNOWLEDGE-GRAPH-001, fila A2). Ver `docs/VERSE_KNOWLEDGE_GRAPH.md` §4.
 *
 * A cadeia é **obra → edição → ativo**, e cada elo responde a uma pergunta
 * diferente:
 *
 * - a **obra** diz quem escreveu e quando, e nada mais;
 * - a **edição** diz qual texto concreto foi lido, em que idioma, com que
 *   licença e como alguém chega a ele;
 * - o **ativo** existe apenas quando guardamos bytes, e então exige SHA-256,
 *   origem e data de recuperação.
 *
 * Separar os três não é purismo. "Agostinho" não é citável; "Agostinho,
 * *De Genesi ad litteram*, edição X, p. 42" é. Guardar autor, edição e arquivo
 * no mesmo registro faria a mesma obra reaparecer uma vez por edição, e a
 * atribuição de licença — que é por edição, não por autor — ficaria errada
 * justamente onde a licença cobra precisão.
 *
 * `Locator` é obrigatório em toda evidência. Sem localização não há conferência
 * possível: a afirmação pode estar certa e continuar não verificável, o que no
 * fim dá no mesmo que não ter fonte.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

import { z } from "zod";
import {
  httpsUrl,
  isoDate,
  issuesOf,
  languageTag,
  optionalText,
  requiredText,
  sha256,
  sourceTier,
  stableId,
} from "./primitives";

/* ------------------------------------------------------------------ direitos */

/**
 * Situação de direitos da **edição**. `desconhecido` é um estado honesto e
 * precisa existir: fonte localizada sem licença conferida é comum, e tratá-la
 * como livre por omissão é o erro que o catálogo lexical já evitou ao recusar o
 * `Meaning` do TBESH.
 */
export const RIGHTS_STATUSES = [
  "dominio_publico",
  "cc0",
  "cc-by-4.0",
  "cc-by-sa-4.0",
  "licenca_proprietaria",
  "permissao_concedida",
  "permissao_necessaria",
  "desconhecido",
] as const;

export type RightsStatus = (typeof RIGHTS_STATUSES)[number];

/** Estados em que nada pode ser publicado, por mais completa que seja a ficha. */
const RIGHTS_NOT_CLEARED: ReadonlySet<RightsStatus> = new Set<RightsStatus>(["permissao_necessaria", "desconhecido"]);

export const RightsSchema = z
  .strictObject({
    status: z.enum(RIGHTS_STATUSES),
    /** Crédito exigido pela licença, no texto que será exibido. */
    attribution: requiredText,
    permissions: z.strictObject({
      store: z.boolean(),
      process: z.boolean(),
      display: z.boolean(),
      quote: z.boolean(),
    }),
    /** Limite de citação em caracteres. `null` = sem limite declarado. */
    quoteLimitChars: z.number().int().positive().max(100_000).nullable().default(null),
    /** Onde a licença está publicada. Recomendado sempre, exigido fora do domínio público. */
    licenseUrl: httpsUrl.nullable().default(null),
    verifiedBy: optionalText,
    verifiedAt: isoDate.nullable().default(null),
    note: optionalText,
  })
  .check((ctx) => {
    const rights = ctx.value;
    const granted = Object.values(rights.permissions).some((value) => value);
    if (RIGHTS_NOT_CLEARED.has(rights.status) && granted) {
      ctx.issues.push({
        code: "custom",
        input: rights,
        path: ["permissions"],
        message: `Situação ${rights.status} não pode conceder permissão de uso`,
      });
    }
    if (rights.permissions.quote && !rights.permissions.display) {
      ctx.issues.push({
        code: "custom",
        input: rights,
        path: ["permissions", "display"],
        message: "Permitir citação sem permitir exibição é contraditório",
      });
    }
  });

export type Rights = z.infer<typeof RightsSchema>;

/**
 * Erros que impedem publicar algo apoiado nesta edição. Devolve lista vazia
 * quando a ficha está completa; não há valor de retorno booleano porque quem
 * chama precisa dizer **o que** falta.
 */
export function rightsPublicationErrors(rights: Rights): readonly string[] {
  const errors: string[] = [];
  if (RIGHTS_NOT_CLEARED.has(rights.status)) errors.push(`Direitos em estado ${rights.status}: não publicável`);
  if (!rights.permissions.display) errors.push("A licença registrada não permite exibição");
  if (rights.status !== "dominio_publico" && rights.licenseUrl === null) errors.push("Informe a URL da licença");
  if (rights.verifiedBy === null || rights.verifiedAt === null) errors.push("Registre quem conferiu os direitos e quando");
  return errors;
}

/** Citação dentro do limite declarado pela licença. */
export function quotationWithinLimit(rights: Rights, quotation: string): boolean {
  if (!rights.permissions.quote) return false;
  if (rights.quoteLimitChars === null) return true;
  return quotation.trim().length <= rights.quoteLimitChars;
}

/* ----------------------------------------------------------------- localização */

/**
 * Localização reproduzível. Cada variante existe porque um tipo de fonte não
 * localiza como o outro: manuscrito tem fólio, relatório tem seção, aparato tem
 * entrada, texto bíblico tem referência canônica. Um campo de texto livre
 * aceitaria "cf. passim", que não localiza nada.
 */
export const LocatorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("pagina"),
    page: requiredText,
    pageEnd: optionalText,
    volume: optionalText,
  }),
  z.strictObject({
    kind: z.literal("secao"),
    /** Caminho hierárquico, ex. "III.2.4" ou "Capítulo 2 > Excurso". */
    path: requiredText,
    heading: optionalText,
  }),
  z.strictObject({
    kind: z.literal("paragrafo"),
    paragraph: requiredText,
    section: optionalText,
  }),
  z.strictObject({
    kind: z.literal("folio"),
    folio: requiredText,
    side: z.enum(["recto", "verso"]).nullable().default(null),
    column: optionalText,
    line: optionalText,
  }),
  z.strictObject({
    kind: z.literal("linha"),
    line: requiredText,
    column: optionalText,
  }),
  z.strictObject({
    kind: z.literal("referencia_canonica"),
    /** Referência no formato do índice (`GEN 1:1`); a âncora tipada fica na evidência. */
    reference: requiredText,
  }),
  z.strictObject({
    kind: z.literal("aparato"),
    /** Entrada do aparato crítico, ex. "ad 1,1 b". */
    entry: requiredText,
    apparatus: optionalText,
  }),
  z.strictObject({
    kind: z.literal("verbete"),
    headword: requiredText,
    sense: optionalText,
  }),
  z.strictObject({
    kind: z.literal("numero_catalogo"),
    /** Número de inventário/catálogo do objeto ou da inscrição. */
    catalogNumber: requiredText,
    collection: optionalText,
  }),
]);

export type Locator = z.infer<typeof LocatorSchema>;

export function formatLocator(locator: Locator): string {
  switch (locator.kind) {
    case "pagina": {
      const pages = locator.pageEnd === null ? `p. ${locator.page}` : `pp. ${locator.page}-${locator.pageEnd}`;
      return locator.volume === null ? pages : `v. ${locator.volume}, ${pages}`;
    }
    case "secao":
      return locator.heading === null ? `§ ${locator.path}` : `§ ${locator.path} (${locator.heading})`;
    case "paragrafo":
      return locator.section === null ? `par. ${locator.paragraph}` : `${locator.section}, par. ${locator.paragraph}`;
    case "folio": {
      const side = locator.side === null ? "" : locator.side === "recto" ? "r" : "v";
      const column = locator.column === null ? "" : `, col. ${locator.column}`;
      const line = locator.line === null ? "" : `, l. ${locator.line}`;
      return `fol. ${locator.folio}${side}${column}${line}`;
    }
    case "linha":
      return locator.column === null ? `l. ${locator.line}` : `col. ${locator.column}, l. ${locator.line}`;
    case "referencia_canonica":
      return locator.reference;
    case "aparato":
      return locator.apparatus === null ? `aparato ${locator.entry}` : `${locator.apparatus}, ${locator.entry}`;
    case "verbete":
      return locator.sense === null ? `s.v. ${locator.headword}` : `s.v. ${locator.headword} (${locator.sense})`;
    case "numero_catalogo":
      return locator.collection === null ? `cat. ${locator.catalogNumber}` : `${locator.collection} ${locator.catalogNumber}`;
  }
}

/* ----------------------------------------------------------------------- obra */

export const AUTHORSHIP_ROLES = ["autor", "editor", "tradutor", "compilador", "instituicao", "atribuicao_tradicional"] as const;

/**
 * `atribuicao_tradicional` existe para obras cuja autoria é atribuída pela
 * tradição e disputada pela crítica. Registrar isso como `autor` transformaria
 * uma atribuição em fato dentro do índice.
 */
export const AuthorshipSchema = z.strictObject({
  name: requiredText,
  role: z.enum(AUTHORSHIP_ROLES),
  note: optionalText,
});

export type Authorship = z.infer<typeof AuthorshipSchema>;

export const SourceWorkSchema = z
  .strictObject({
    id: stableId,
    title: requiredText,
    authorship: z.array(AuthorshipSchema).min(1),
    tier: sourceTier,
    originalLanguage: languageTag,
    /** Datação como se escreve em bibliografia, ex. "fim do séc. IV". */
    dateExpression: requiredText,
    /** Ano mais antigo plausível; negativo para antes da era comum. */
    dateEarliest: z.number().int().min(-4000).max(2200).nullable().default(null),
    dateLatest: z.number().int().min(-4000).max(2200).nullable().default(null),
    /** Tradição/escola declarada, quando houver. Nunca inferida pelo sistema. */
    tradition: optionalText,
    note: optionalText,
  })
  .check((ctx) => {
    const work = ctx.value;
    if (work.dateEarliest !== null && work.dateLatest !== null && work.dateEarliest > work.dateLatest) {
      ctx.issues.push({ code: "custom", input: work, path: ["dateLatest"], message: "O ano final não pode ser anterior ao inicial" });
    }
  });

export type SourceWork = z.infer<typeof SourceWorkSchema>;

/* --------------------------------------------------------------------- edição */

/**
 * Como alguém chega ao texto. `digital` exige identificador persistente e data
 * de acesso; `impressa` exige ficha bibliográfica e, de preferência, o acervo
 * onde o exemplar foi consultado. Uma das duas é obrigatória: edição sem
 * caminho de acesso não é conferível.
 */
export const AvailabilitySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("digital"),
    identifier: httpsUrl,
    accessedAt: isoDate,
  }),
  z.strictObject({
    kind: z.literal("impressa"),
    bibliographicRecord: requiredText,
    holding: optionalText,
  }),
]);

export type Availability = z.infer<typeof AvailabilitySchema>;

export const SourceEditionSchema = z.strictObject({
  id: stableId,
  workId: stableId,
  /** Rótulo da edição, ex. "ed. Rahlfs-Hanhart, 2006" ou "Clementina, 1592". */
  label: requiredText,
  language: languageTag,
  responsibility: z.array(AuthorshipSchema).default([]),
  year: z.number().int().min(-4000).max(2200).nullable().default(null),
  availability: AvailabilitySchema,
  rights: RightsSchema,
  note: optionalText,
});

export type SourceEdition = z.infer<typeof SourceEditionSchema>;

/* ----------------------------------------------------------------------- ativo */

/**
 * Bytes guardados por nós. Sempre com SHA-256, origem e data: é o mesmo
 * contrato de pino que o pipeline lexical usa, e pela mesma razão — sem hash
 * conferido não se sabe se o arquivo de hoje é o que foi citado ontem.
 *
 * O ativo não repete licença: ela é da edição. Guardar duas cópias da ficha de
 * direitos é garantir que uma delas fique desatualizada.
 */
export const SourceArtifactSchema = z.strictObject({
  id: stableId,
  editionId: stableId,
  /** Caminho local, fora de `public/`, como os corpora já armazenados. */
  localPath: requiredText,
  sha256,
  byteLength: z.number().int().positive(),
  mediaType: requiredText,
  retrievedFrom: httpsUrl,
  retrievedAt: isoDate,
  note: optionalText,
});

export type SourceArtifact = z.infer<typeof SourceArtifactSchema>;

/* ------------------------------------------------------------------ validação */

export function validateSourceWork(input: unknown): readonly string[] {
  const parsed = SourceWorkSchema.safeParse(input);
  return parsed.success ? [] : issuesOf(parsed.error, "work");
}

export function validateSourceEdition(input: unknown): readonly string[] {
  const parsed = SourceEditionSchema.safeParse(input);
  return parsed.success ? [] : issuesOf(parsed.error, "edition");
}

export function validateSourceArtifact(input: unknown): readonly string[] {
  const parsed = SourceArtifactSchema.safeParse(input);
  return parsed.success ? [] : issuesOf(parsed.error, "artifact");
}

/** Citação curta e estável para bibliografia, montada dos registros. */
export function citationLabel(work: SourceWork, edition: SourceEdition, locator: Locator | null): string {
  const author = work.authorship[0]?.name ?? "Autoria não identificada";
  const year = edition.year === null ? work.dateExpression : String(edition.year);
  const place = locator === null ? "" : `, ${formatLocator(locator)}`;
  return `${author}, ${work.title} (${edition.label}, ${year})${place}`;
}
