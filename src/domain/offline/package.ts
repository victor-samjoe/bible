import { z } from "zod";

/**
 * Contrato do pacote offline da Bíblia.
 *
 * O que este módulo é: funções puras e esquemas. Nada de rede, disco, banco ou
 * `navigator`. Quem constrói o pacote está em `src/server/offline/**`; quem o
 * instala no aparelho está em `src/client/offline/**`. Os dois lados usam estes
 * mesmos esquemas, de propósito: o que o construtor escreve é exatamente o que o
 * instalador exige, e uma divergência aparece como erro de validação em vez de
 * virar texto bíblico errado na tela.
 *
 * Decisões que este contrato existe para sustentar:
 *
 * - **Partição por livro, não por capítulo nem arquivo único.** 1.189 capítulos
 *   seriam 1.189 requisições; um arquivo único de ~4 MB não permite baixar só o
 *   que falta nem retomar. 66 arquivos, o maior deles Salmos com ~236 KB,
 *   permitem retomada e atualização parcial.
 * - **Versão derivada do conteúdo.** `version` é o SHA-256 do corpo canônico do
 *   manifesto; mesmo conteúdo, mesma versão. Isso é o que permite dizer "não
 *   mudou, não baixe de novo" sem confiar em data de build, e é o que torna a
 *   URL imutável e cacheável para sempre.
 * - **Sem `builtAt` no manifesto.** Um carimbo de hora mudaria o manifesto a
 *   cada reconstrução, trocaria o ETag e retransmitiria pacote idêntico. A data
 *   da construção fica no relatório da tarefa, não no artefato.
 * - **Atribuição viaja dentro do pacote.** A licença da BLIVRE (CC BY 4.0 BR)
 *   permite redistribuir o texto em qualquer formato "provided that you include
 *   the above copyright and source information" — ver
 *   `data/source/porbr2018_usfm/copr.htm`. Um pacote baixado é redistribuição,
 *   então o crédito não pode ficar só no servidor: vai no manifesto e em cada
 *   arquivo de livro.
 * - **Nada além do texto público.** O pacote não tem identificador de usuário,
 *   nota pessoal, rascunho de tradução, léxico, chave nem UUID de banco. O
 *   esquema abaixo não tem campo onde esse dado caberia, e
 *   `assertPublicPayload` recusa o que escapar.
 */

/** Identificador do formato. Muda junto com uma quebra de compatibilidade. */
export const OFFLINE_PACKAGE_SCHEMA = "samjoe.offline.bible/1" as const;

/** Raiz pública dos artefatos. A versão entra no caminho, por isso é imutável. */
export const OFFLINE_PACKAGE_BASE_PATH = "/biblia-offline" as const;

/** Caminho do manifesto. Estável: é o único recurso consultado por atualização. */
export const OFFLINE_MANIFEST_PATH = `${OFFLINE_PACKAGE_BASE_PATH}/manifest.json` as const;

const sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/u, "SHA-256 deve ter 64 dígitos hexadecimais minúsculos");

const bookCodeSchema = z.string().regex(/^[1-9A-Z]{3}$/u, "código de livro inválido");

/**
 * Crédito e proveniência da edição. Tudo aqui é metadado público verificável:
 * `archiveSha256` é o checksum do pacote oficial, conferível contra
 * `data/source/README.md`, e `sourceSignedAt` é a data da assinatura do
 * distribuidor, que é a "data correta da versão" que a própria licença manda
 * indicar — a obra é declarada como trabalho em andamento.
 */
export const offlineEditionSchema = z
  .object({
    identifier: z.literal("porbr2018"),
    name: z.string().min(1),
    abbreviation: z.string().min(1),
    language: z.literal("pt-BR"),
    canon: z.string().min(1),
    license: z.string().min(1),
    licenseUrl: z.string().url(),
    attribution: z.string().min(1),
    sourceUrl: z.string().url(),
    archiveSha256: sha256Schema,
    sourceSignedAt: z.string().min(1),
    redistribution: z.string().min(1),
  })
  .strict();

export type OfflineEdition = z.infer<typeof offlineEditionSchema>;

export const offlineFileEntrySchema = z
  .object({
    book: bookCodeSchema,
    name: z.string().min(1),
    /**
     * Mesmo `slug` que o leitor usa na URL (`/biblia/genesis/1`). Está aqui
     * porque é o que a leitura offline tem em mãos quando a navegação falha: o
     * caminho. Sem ele, a casca offline teria de deduzir o livro pela grafia do
     * nome, e deduzir identificador por grafia é exatamente o erro que a frente
     * lexical já pagou para aprender.
     */
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/u, "slug deve ter apenas minúsculas, dígitos e hífen"),
    order: z.number().int().min(1).max(66),
    path: z.string().min(1),
    chapters: z.number().int().min(1),
    verses: z.number().int().min(1),
    bytes: z.number().int().min(1),
    /** Hash do arquivo como ele é servido, com versão e crédito dentro. */
    sha256: sha256Schema,
    /**
     * Hash só do texto do livro, sem a versão do pacote nem o crédito.
     *
     * É o que permite atualizar sem baixar tudo de novo: numa versão nova, o
     * caminho de **todos** os arquivos muda, porque a versão está no caminho, e
     * por isso `sha256` também muda em todos. `contentSha256` não — ele só muda
     * se o texto daquele livro mudou. Uma correção em um livro passa a custar o
     * tamanho daquele livro, e não os 4 MB do pacote inteiro; os demais são
     * copiados do que já está gravado no aparelho.
     */
    contentSha256: sha256Schema,
  })
  .strict();

export type OfflineFileEntry = z.infer<typeof offlineFileEntrySchema>;

/**
 * Livros que podem ser reaproveitados de uma instalação anterior, por terem o
 * mesmo texto, e os que precisam ser baixados.
 *
 * A comparação é por `contentSha256`, nunca por nome, ordem ou posição: é a
 * identidade do conteúdo que autoriza a cópia local. Sem instalação anterior,
 * tudo é download.
 */
export function planUpdate(
  target: OfflineManifest,
  installed: OfflineManifest | null,
): { readonly reusable: readonly OfflineFileEntry[]; readonly toDownload: readonly OfflineFileEntry[] } {
  if (!installed) return { reusable: [], toDownload: target.files };

  const byContent = new Map(installed.files.map((file) => [`${file.book}:${file.contentSha256}`, file]));
  const reusable: OfflineFileEntry[] = [];
  const toDownload: OfflineFileEntry[] = [];

  for (const file of target.files) {
    const previous = byContent.get(`${file.book}:${file.contentSha256}`);
    // Além do conteúdo igual, as quantidades têm de coincidir: se não
    // coincidirem, algo está incoerente e a cópia local não é segura.
    if (previous && previous.chapters === file.chapters && previous.verses === file.verses) {
      reusable.push(file);
    } else {
      toDownload.push(file);
    }
  }

  return { reusable, toDownload };
}

export const offlineManifestSchema = z
  .object({
    schema: z.literal(OFFLINE_PACKAGE_SCHEMA),
    version: sha256Schema,
    edition: offlineEditionSchema,
    totals: z
      .object({
        books: z.number().int().min(1),
        chapters: z.number().int().min(1),
        verses: z.number().int().min(1),
        bytes: z.number().int().min(1),
      })
      .strict(),
    files: z.array(offlineFileEntrySchema).min(1),
  })
  .strict();

export type OfflineManifest = z.infer<typeof offlineManifestSchema>;

/**
 * Arquivo de um livro. `chapters[i]` é o capítulo `i + 1` e cada posição é o
 * versículo correspondente, a partir de 1 — ver `assertContiguousNumbering`,
 * que é o motivo pelo qual essa suposição é segura em vez de otimista.
 */
export const offlineBookFileSchema = z
  .object({
    schema: z.literal(OFFLINE_PACKAGE_SCHEMA),
    version: sha256Schema,
    book: bookCodeSchema,
    name: z.string().min(1),
    attribution: z.string().min(1),
    chapters: z.array(z.array(z.string().min(1)).min(1)).min(1),
  })
  .strict();

export type OfflineBookFile = z.infer<typeof offlineBookFileSchema>;

/**
 * Motivos de recusa. Fechados: nada aqui descreve infraestrutura nem caminho.
 *
 * São distintos de propósito. "Não consegui falar com o servidor"
 * (`source_unreachable`), "o arquivo que chegou não é o que o manifesto
 * descreve" (`hash_mismatch`) e "não há espaço" (`storage_full`) levam a
 * decisões diferentes de quem usa e a mensagens diferentes na tela; colapsá-los
 * em "erro" transformaria uma resposta adulterada em problema de rede.
 */
export type OfflineFailureReason =
  | "manifest_invalid"
  | "manifest_schema_unsupported"
  | "file_invalid"
  | "file_unexpected_book"
  | "file_version_mismatch"
  | "hash_mismatch"
  | "size_mismatch"
  | "size_over_budget"
  | "incomplete"
  | "not_installed"
  | "chapter_absent"
  | "consent_absent"
  /**
   * A pessoa removeu o pacote, ou desativou o download, **enquanto** uma
   * atualização estava em curso. Diferente de `consent_absent`, que é não ter
   * começado: aqui havia consentimento no início e deixou de haver antes da
   * troca. A instalação é descartada em vez de promovida, e a tela precisa
   * poder dizer isso sem chamar de erro, porque não é — é a remoção funcionando.
   */
  | "consent_revoked"
  /**
   * A preferência mudou durante a operação, **sem** deixar de haver
   * consentimento: tipicamente outra aba guardou um ETag, registrou uma
   * verificação ou reativou o download.
   *
   * Existe separado de `consent_revoked` porque a reação tem de ser outra. Na
   * primeira versão desta correção os dois casos voltavam como
   * `consent_revoked`, e o verificador respondia apagando tudo — então uma
   * simples gravação de ETag em outra aba apagava um pacote instalado e
   * íntegro, que ninguém pediu para remover. Aqui a instalação em curso é
   * descartada e o que já estava instalado permanece.
   */
  | "preference_changed"
  | "source_unreachable"
  | "storage_full"
  | "locked"
  | "aborted";

export type OfflineFailure = { readonly ok: false; readonly reason: OfflineFailureReason };

export type OfflineResult<T> = ({ readonly ok: true } & T) | OfflineFailure;

export function offlineFailure(reason: OfflineFailureReason): OfflineFailure {
  return { ok: false, reason };
}

/**
 * Teto de tamanho por arquivo e por pacote.
 *
 * Não é estimativa de quanto o pacote tem: é o limite acima do qual o
 * instalador para em vez de escrever. Serve contra resposta trocada por outra
 * coisa — uma página de erro HTML grande, um redirecionamento para um arquivo
 * alheio — e contra encher o armazenamento do aparelho por engano. Os valores
 * são folgados em relação à medição real (pacote de ~4,1 MB, maior arquivo
 * ~236 KB) para não falhar numa revisão editorial que acrescente texto.
 */
export const OFFLINE_FILE_BYTES_LIMIT = 4 * 1024 * 1024;
export const OFFLINE_PACKAGE_BYTES_LIMIT = 32 * 1024 * 1024;

/**
 * Serialização canônica: chaves na ordem declarada pelo próprio objeto, sem
 * espaço e sem reordenação implícita. O hash só é reproduzível se os bytes
 * forem. `JSON.stringify` já preserva a ordem de inserção para chaves de
 * string, então a função existe para deixar a exigência explícita e num lugar
 * só, não para reordenar nada.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export function sizeInBytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Versão do pacote: SHA-256 do manifesto sem o campo `version`. Depende apenas
 * da edição, da lista de arquivos e dos hashes de conteúdo — portanto de nada
 * que mude entre duas construções do mesmo texto.
 */
export async function derivePackageVersion(
  manifest: Omit<OfflineManifest, "version">,
  digest: (text: string) => Promise<string>,
): Promise<string> {
  return await digest(canonicalJson(manifest));
}

/**
 * Numeração contígua a partir de 1, capítulo por capítulo.
 *
 * O formato guarda versículos como posições de um array, o que é o que faz o
 * pacote caber em ~4 MB em vez de ~8,5 MB. Essa economia só é honesta se a
 * numeração for de fato 1..n: uma edição com lacuna (um versículo não publicado
 * no meio do capítulo, por exemplo) renumeraria o texto em silêncio e mostraria
 * o versículo errado sob o número errado. Por isso a construção **falha** em
 * vez de acomodar, e a mensagem diz onde.
 */
export function assertContiguousNumbering(
  book: string,
  chapters: readonly { readonly number: number; readonly verses: readonly { readonly number: number }[] }[],
): void {
  for (const [index, chapter] of chapters.entries()) {
    if (chapter.number !== index + 1) {
      throw new Error(
        `${book}: capítulos fora de sequência — esperado ${index + 1}, encontrado ${chapter.number}`,
      );
    }
    for (const [position, verse] of chapter.verses.entries()) {
      if (verse.number !== position + 1) {
        throw new Error(
          `${book} ${chapter.number}: numeração não contígua — esperado versículo ${position + 1}, encontrado ${verse.number}. ` +
            "O formato do pacote guarda versículos por posição; renumerar em silêncio mostraria texto sob número errado.",
        );
      }
    }
  }
}

/**
 * Recusa conteúdo que não seja texto bíblico público.
 *
 * O pacote é servido como arquivo estático, sem autenticação, e fica no
 * aparelho de quem baixou. Nada de pessoal, nenhuma chave e nenhum rascunho
 * pode entrar nele nem por descuido de quem montar outro construtor depois.
 *
 * As checagens são **estruturais**, não lexicais, e isso não é detalhe: a
 * primeira versão procurava as palavras `secret` e `senha` e recusou o pacote
 * inteiro por causa de "Sausa, secretário" em 1Cr 18:16 — em JavaScript `\b` é
 * ASCII, então qualquer letra acentuada conta como fronteira de palavra e
 * `secret` casa dentro de "secretário". Guarda que acusa prosa bíblica é guarda
 * que alguém desliga. O que sobrou só reconhece coisa que texto corrido não
 * produz: UUID, JWT, URL de banco, chave privada e atribuição de credencial
 * (`token: ...`, `api_key=...`), em que o separador é a prova.
 */
const SUSPICIOUS = [
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/u,
  /postgres(?:ql)?:\/\//iu,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
  /(?:api[_-]?key|(?:access[_-]?)?token|secret|password|senha)["'\s]*[:=]["'\s]*\S/iu,
  /Bearer\s+[A-Za-z0-9._-]{16,}/u,
];

export function assertPublicPayload(label: string, text: string): void {
  for (const pattern of SUSPICIOUS) {
    const found = pattern.exec(text);
    if (found) {
      throw new Error(
        `${label}: conteúdo suspeito de dado não público (${pattern.source}); nada foi escrito`,
      );
    }
  }
}

/**
 * Valida um arquivo de livro recém-baixado contra o manifesto.
 *
 * Confere, nesta ordem: tamanho dentro do teto, tamanho igual ao declarado,
 * hash igual ao declarado, formato, livro esperado e versão do pacote. A ordem
 * importa: hash antes de `JSON.parse` evita gastar memória analisando resposta
 * trocada, e a conferência de livro e versão pega o caso em que o hash bate
 * porque o arquivo é um arquivo legítimo **de outra coisa**.
 */
export function verifyBookFile(
  entry: OfflineFileEntry,
  manifestVersion: string,
  bytes: number,
  computedSha256: string,
  parsed: unknown,
): OfflineResult<{ file: OfflineBookFile }> {
  if (bytes > OFFLINE_FILE_BYTES_LIMIT) return offlineFailure("size_over_budget");
  if (bytes !== entry.bytes) return offlineFailure("size_mismatch");
  if (computedSha256 !== entry.sha256) return offlineFailure("hash_mismatch");

  const file = offlineBookFileSchema.safeParse(parsed);
  if (!file.success) return offlineFailure("file_invalid");
  if (file.data.book !== entry.book) return offlineFailure("file_unexpected_book");
  if (file.data.version !== manifestVersion) return offlineFailure("file_version_mismatch");
  if (file.data.chapters.length !== entry.chapters) return offlineFailure("file_invalid");

  const verses = file.data.chapters.reduce((total, chapter) => total + chapter.length, 0);
  if (verses !== entry.verses) return offlineFailure("file_invalid");

  return { ok: true, file: file.data };
}

/**
 * Valida um manifesto recebido da rede antes de qualquer download.
 *
 * Além do esquema, confere coerência interna: totais iguais à soma dos
 * arquivos, caminhos sob a versão declarada (um caminho fora dela permitiria
 * ao manifesto apontar para arquivo de outra versão ou de fora do pacote),
 * livros e ordens sem repetição, e orçamento total.
 */
export function verifyManifest(parsed: unknown): OfflineResult<{ manifest: OfflineManifest }> {
  const candidate = offlineManifestSchema.safeParse(parsed);
  if (!candidate.success) {
    const schemaIssue = candidate.error.issues.some(
      (issue) => issue.path.length === 1 && issue.path[0] === "schema",
    );
    return offlineFailure(schemaIssue ? "manifest_schema_unsupported" : "manifest_invalid");
  }

  const manifest = candidate.data;
  if (manifest.files.length !== manifest.totals.books) return offlineFailure("manifest_invalid");

  const prefix = `${OFFLINE_PACKAGE_BASE_PATH}/${manifest.version}/`;
  const books = new Set<string>();
  const orders = new Set<number>();
  let chapters = 0;
  let verses = 0;
  let bytes = 0;

  for (const file of manifest.files) {
    if (!file.path.startsWith(prefix)) return offlineFailure("manifest_invalid");
    if (file.path.includes("..")) return offlineFailure("manifest_invalid");
    if (file.path !== `${prefix}${file.book}.json`) return offlineFailure("manifest_invalid");
    if (books.has(file.book) || orders.has(file.order)) return offlineFailure("manifest_invalid");
    if (file.bytes > OFFLINE_FILE_BYTES_LIMIT) return offlineFailure("size_over_budget");
    books.add(file.book);
    orders.add(file.order);
    chapters += file.chapters;
    verses += file.verses;
    bytes += file.bytes;
  }

  if (chapters !== manifest.totals.chapters) return offlineFailure("manifest_invalid");
  if (verses !== manifest.totals.verses) return offlineFailure("manifest_invalid");
  if (bytes !== manifest.totals.bytes) return offlineFailure("manifest_invalid");
  if (bytes > OFFLINE_PACKAGE_BYTES_LIMIT) return offlineFailure("size_over_budget");

  return { ok: true, manifest };
}

/**
 * Tamanho que se promete a quem vai decidir baixar.
 *
 * `downloadBytes` é o que o manifesto declara: o texto sem compressão. A
 * transferência real costuma ser bem menor porque a CDN comprime, e o
 * armazenamento ocupado no aparelho costuma ser **maior** que o texto, porque o
 * navegador guarda strings e índices próprios. Por isso a interface mostra o
 * número do manifesto como tamanho de download e trata o resto como estimativa
 * medida, nunca como promessa.
 */
export function describeDownloadSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}
