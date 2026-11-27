/**
 * Identidade lexical do índice de estudo de palavras (fila Claude 3, item 2).
 *
 * Responde a uma pergunta só: **o que conta como "a mesma palavra"** quando o
 * produto promete "usos em toda a Bíblia". A resposta não é óbvia e não é única,
 * então ela é *dado versionado* (`IdentityPolicy`), não regra embutida: trocar a
 * política é trocar um valor e remontar o índice, não reescrever o módulo.
 *
 * Três decisões que este módulo faz valer, todas vindas da auditoria do item 1
 * (`tasks/product/word-study-01-inventario-acesso.md`):
 *
 * 1. **O sufixo de homógrafo faz parte da identidade.** `H1254a` ("criar") e
 *    `H1254b` ("engordar") são palavras diferentes que dividem o número. Quem
 *    descarta o sufixo cola a acepção de uma na outra — foi o achado §3.1, e é
 *    por isso que `homograph` é campo próprio e entra na chave.
 * 2. **Prefixo divergente é erro, não detalhe a corrigir em silêncio.** Um
 *    Strong grego oferecido como hebraico não é normalizado para hebraico: é
 *    recusado com motivo. (`strongLexemeKey` de `domain/lexicon/records.ts`
 *    captura o prefixo e não o usa, de modo que `("hbo", "G1510")` devolve
 *    `hbo:H1510`. Aqui isso falha fechado.)
 * 3. **Reunir formas ao lema exige fonte.** No grego, o Strong publicado pelo
 *    MACULA identifica a *forma* (`ἦν` = G2258), não o lema (`εἰμί` = G1510).
 *    Reuni-los exigiria a coluna `dStrong` do TBESG, que o registro de fontes
 *    recusa importar por decisão registrada. Então o mapa de redução nasce
 *    **vazio e declarado vazio** (`foldMapSource: null`): o índice informa que
 *    não reúne, em vez de devolver contagem baixa com cara de completa.
 *
 * Módulo puro: sem `node:*`, sem rede, sem banco, sem relógio.
 */

export const WORD_STUDY_IDENTITY_VERSION = "2026-11-25.1";

export type WordStudyLanguage = "hbo" | "grc";

/** Prefixo canônico do idioma, como as fontes o publicam. */
export function languagePrefix(language: WordStudyLanguage): "H" | "G" {
  return language === "hbo" ? "H" : "G";
}

/**
 * Strong de uma fonte, decomposto. `homograph` é a letra que a tradição
 * lexicográfica usa para separar palavras distintas sob o mesmo número; vem do
 * sufixo (`"1254 a"`, `"0871a"`) ou do atributo `aug` do `LexicalIndex.xml`.
 */
export type StrongRef = {
  readonly language: WordStudyLanguage;
  readonly number: number;
  readonly homograph: string | null;
};

export type LexicalIdentity = {
  /** Chave canônica: `hbo:H1254a`, `grc:G1510`, `hbo:lemma:בְּ`. */
  readonly key: string;
  readonly language: WordStudyLanguage;
  /** `null` quando a fonte não publica Strong para este item. */
  readonly strong: StrongRef | null;
  /** Presente só quando a identidade é pelo lema, por falta de Strong. */
  readonly lemma: string | null;
};

export type IdentityProblem = {
  readonly raw: string;
  readonly reason: string;
};

const STRONG_SHAPE = /^([HG])?\s*0*(\d{1,5})\s*([a-z])?$/iu;

/**
 * Lê o Strong como a fonte o escreve. Aceita `"H1254"`, `"1254"`, `"0871a"`,
 * `"1254 a"`, `"G0001"`. Recusa — com motivo, sem consertar — prefixo de outro
 * idioma, número fora de faixa e qualquer coisa que não tenha essa forma.
 *
 * O zero à esquerda é removido porque as fontes discordam dele (`0430` no
 * MACULA, `H0430` no HebrewStrong, `430` no LexicalIndex) e manter a divergência
 * partiria a mesma palavra em três chaves. O sufixo, ao contrário, é preservado:
 * ele distingue palavras, não grafias.
 */
export function parseStrong(
  language: WordStudyLanguage,
  raw: string,
): { readonly strong: StrongRef } | { readonly problem: IdentityProblem } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { problem: { raw, reason: "Strong vazio" } };
  }
  const match = STRONG_SHAPE.exec(trimmed);
  if (!match) {
    return { problem: { raw, reason: `Strong fora da forma esperada: '${trimmed}'` } };
  }
  const declared = match[1]?.toUpperCase() ?? null;
  const expected = languagePrefix(language);
  if (declared !== null && declared !== expected) {
    return {
      problem: {
        raw,
        reason:
          `Strong com prefixo '${declared}' oferecido como ${language} (esperado ` +
          `'${expected}'); divergência de idioma não é normalizada`,
      },
    };
  }
  const number = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isSafeInteger(number) || number <= 0) {
    return { problem: { raw, reason: `número de Strong inválido: '${trimmed}'` } };
  }
  const homograph = match[3]?.toLowerCase() ?? null;
  return { strong: { language, number, homograph } };
}

/**
 * Junta o Strong ao atributo `aug` publicado separadamente pelo
 * `LexicalIndex.xml` (`strong="1254" aug="b"` = H1254b). Conflito entre sufixo
 * já presente e `aug` divergente é recusado: os dois dizem a mesma coisa, e
 * discordarem significa que uma das duas leituras está errada.
 */
export function withAugment(
  strong: StrongRef,
  augment: string | null | undefined,
): { readonly strong: StrongRef } | { readonly problem: IdentityProblem } {
  const aug = (augment ?? "").trim().toLowerCase();
  if (aug.length === 0) return { strong };
  if (!/^[a-z]$/u.test(aug)) {
    return { problem: { raw: aug, reason: `atributo aug fora da forma de letra única: '${aug}'` } };
  }
  if (strong.homograph !== null && strong.homograph !== aug) {
    return {
      problem: {
        raw: `${strongLabel(strong)}+aug=${aug}`,
        reason: `sufixo '${strong.homograph}' e aug '${aug}' discordam`,
      },
    };
  }
  return { strong: { ...strong, homograph: aug } };
}

/** Rótulo exibível: `H1254a`, `G1510`. */
export function strongLabel(strong: StrongRef): string {
  return `${languagePrefix(strong.language)}${strong.number}${strong.homograph ?? ""}`;
}

export function identityOfStrong(strong: StrongRef): LexicalIdentity {
  return {
    key: `${strong.language}:${strongLabel(strong)}`,
    language: strong.language,
    strong,
    lemma: null,
  };
}

/**
 * Identidade pelo lema, para o item que a fonte publica sem Strong. O prefixo
 * `lemma:` existe para que nunca colida com uma chave de Strong, e o lema é
 * normalizado em NFC porque hebraico e grego vocalizados têm mais de uma
 * representação Unicode da mesma palavra.
 */
export function identityOfLemma(
  language: WordStudyLanguage,
  lemma: string,
): { readonly identity: LexicalIdentity } | { readonly problem: IdentityProblem } {
  const normalized = lemma.trim().normalize("NFC");
  if (normalized.length === 0) {
    return { problem: { raw: lemma, reason: "lema vazio" } };
  }
  return {
    identity: {
      key: `${language}:lemma:${normalized}`,
      language,
      strong: null,
      lemma: normalized,
    },
  };
}

/**
 * Como o índice decide que duas ocorrências são da mesma palavra.
 *
 * - `strong-exact`: a chave é o Strong como a fonte o publica, com sufixo de
 *   homógrafo. É o padrão, porque é o que as fontes aprovadas sustentam.
 * - `strong-folded`: além disso, reduz formas flexionadas ao lema, usando
 *   `foldMap`. Só é honesto com um `foldMapSource` nomeado: sem fonte, reduzir
 *   é adivinhar.
 */
export type IdentityPolicy = {
  readonly version: string;
  readonly mode: "strong-exact" | "strong-folded";
  /** chave de forma → chave de lema, ex. `grc:G2258` → `grc:G1510`. */
  readonly foldMap: ReadonlyMap<string, string>;
  /** Proveniência do mapa. `null` = mapa vazio, e o índice declara a lacuna. */
  readonly foldMapSource: string | null;
};

/**
 * Política padrão. `strong-exact` com mapa vazio: é a única que as fontes
 * aprovadas hoje sustentam. A consequência — formas gregas com Strong próprio
 * não se reúnem ao lema — é devolvida como limitação declarada do índice, não
 * escondida numa contagem.
 */
export const DEFAULT_IDENTITY_POLICY: IdentityPolicy = {
  version: WORD_STUDY_IDENTITY_VERSION,
  mode: "strong-exact",
  foldMap: new Map(),
  foldMapSource: null,
};

export class IdentityPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityPolicyError";
  }
}

/**
 * Monta uma política de redução. Exige `foldMapSource` quando o mapa tem
 * entradas: um mapa sem procedência é exatamente a inferência que a fila proíbe.
 */
export function identityPolicy(input: {
  readonly mode: IdentityPolicy["mode"];
  readonly foldMap?: ReadonlyMap<string, string>;
  readonly foldMapSource?: string | null;
  readonly version?: string;
}): IdentityPolicy {
  const foldMap = input.foldMap ?? new Map<string, string>();
  const foldMapSource = input.foldMapSource ?? null;
  if (foldMap.size > 0 && (foldMapSource === null || foldMapSource.trim().length === 0)) {
    throw new IdentityPolicyError(
      "mapa de redução sem fonte declarada; reunir forma e lema exige procedência",
    );
  }
  if (input.mode === "strong-folded" && foldMap.size === 0) {
    throw new IdentityPolicyError(
      "política 'strong-folded' com mapa vazio não reduz nada; use 'strong-exact'",
    );
  }
  return {
    version: input.version ?? WORD_STUDY_IDENTITY_VERSION,
    mode: input.mode,
    foldMap,
    foldMapSource,
  };
}

/** Aplica a política. Em `strong-exact`, devolve a identidade intacta. */
export function applyPolicy(policy: IdentityPolicy, identity: LexicalIdentity): LexicalIdentity {
  if (policy.mode !== "strong-folded") return identity;
  const folded = policy.foldMap.get(identity.key);
  if (folded === undefined || folded === identity.key) return identity;
  const parsed = parseFoldedKey(folded, identity.language);
  return parsed ?? identity;
}

function parseFoldedKey(key: string, language: WordStudyLanguage): LexicalIdentity | null {
  const expected = `${language}:`;
  if (!key.startsWith(expected)) return null;
  const rest = key.slice(expected.length);
  if (rest.startsWith("lemma:")) {
    const result = identityOfLemma(language, rest.slice("lemma:".length));
    return "identity" in result ? result.identity : null;
  }
  const parsed = parseStrong(language, rest);
  return "strong" in parsed ? identityOfStrong(parsed.strong) : null;
}

/**
 * Chave de **ordenação**, diferente da chave de exibição.
 *
 * `key` é legível (`hbo:H1254a`) e serve para procurar; comparada como texto,
 * porém, ela ordera `hbo:H10` antes de `hbo:H9` — o mesmo defeito que o item 1
 * encontrou no índice lexical atual (§3.3). Aqui o número vai com zero à
 * esquerda em largura fixa, de modo que **comparar `sortKey` como texto é
 * comparar canonicamente**. É o que torna correto o limite de partição por
 * intervalo, que é necessariamente uma comparação de strings.
 *
 * Largura 5: o maior Strong hebraico publicado é 8674 e o grego 5624; 5 dígitos
 * cobrem com folga e `parseStrong` recusa mais do que isso.
 *
 * O `1:`/`2:` antes do corpo mantém toda identidade por Strong antes de toda
 * identidade por lema: as que não têm verbete alcançável ficam agrupadas no fim,
 * e não espalhadas entre as partições.
 */
export function identitySortKey(identity: LexicalIdentity): string {
  const strong = identity.strong;
  if (strong) {
    const padded = String(strong.number).padStart(5, "0");
    // `_` ordena antes de qualquer letra minúscula em UTF-16, então a palavra
    // sem sufixo vem antes de `a` e `b`, como na obra impressa.
    return `${identity.language}:1:${padded}${strong.homograph ?? "_"}`;
  }
  return `${identity.language}:2:${identity.lemma ?? ""}`;
}

/**
 * Ordem total e estável das identidades, definida **em termos de
 * `identitySortKey`** para que as duas não possam divergir: se a ordenação em
 * memória e o limite de partição gravado no manifesto discordassem, a consulta
 * leria a partição errada e devolveria vazio em silêncio.
 */
export function compareIdentities(left: LexicalIdentity, right: LexicalIdentity): number {
  const leftKey = identitySortKey(left);
  const rightKey = identitySortKey(right);
  if (leftKey === rightKey) return 0;
  return leftKey < rightKey ? -1 : 1;
}
