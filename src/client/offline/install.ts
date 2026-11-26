import {
  OFFLINE_PACKAGE_SCHEMA,
  offlineFailure,
  planUpdate,
  verifyBookFile,
  verifyManifest,
  type OfflineFailure,
  type OfflineFileEntry,
  type OfflineManifest,
} from "../../domain/offline/package";
import type { InstallationRecord, OfflineStore, PreferenceRecord } from "./storage";

/**
 * Instalação e atualização do pacote offline.
 *
 * Este módulo não toca em `window`, `fetch` global, `crypto` global nem
 * IndexedDB: recebe tudo por injeção. É deliberado — é o que permite testar
 * interrupção, corrupção, falta de espaço e concorrência com entradas pequenas
 * e determinísticas, em vez de só no navegador. Os adaptadores reais estão em
 * `./source` (rede) e `./storage` (IndexedDB).
 */

export type ManifestFetch =
  | { readonly status: "fresh"; readonly parsed: unknown; readonly etag: string | null }
  | { readonly status: "unchanged"; readonly etag: string | null }
  | { readonly status: "unreachable" };

export type BookFetch =
  | { readonly status: "fetched"; readonly text: string; readonly bytes: number }
  | { readonly status: "unreachable" };

export type OfflineSource = {
  fetchManifest(etag: string | null): Promise<ManifestFetch>;
  fetchBook(entry: OfflineFileEntry): Promise<BookFetch>;
};

export type Digest = (text: string) => Promise<string>;

export type InstallProgress = {
  readonly booksDone: number;
  readonly booksTotal: number;
  readonly bytesDone: number;
  readonly bytesTotal: number;
};

export type UpdateCheck =
  | { readonly ok: true; readonly state: "current"; readonly version: string; readonly etag: string | null }
  | {
      readonly ok: true;
      readonly state: "available";
      readonly manifest: OfflineManifest;
      readonly installedVersion: string | null;
      readonly etag: string | null;
    }
  | { readonly ok: true; readonly state: "unchanged"; readonly version: string; readonly etag: string | null }
  | OfflineFailure;

export type InstallOutcome =
  | {
      readonly ok: true;
      readonly installation: InstallationRecord;
      readonly resumedBooks: number;
      readonly reusedBooks: number;
      readonly downloadedBytes: number;
      readonly prunedChapters: number;
    }
  | OfflineFailure;

/**
 * Teto de tentativas por arquivo. Baixo de propósito: o pacote é retomável, e
 * insistir muito numa rede ruim gasta dados de quem talvez esteja no celular.
 * Uma instalação interrompida continua de onde parou na próxima tentativa.
 */
const ATTEMPTS_PER_BOOK = 2;

function storageFull(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "QuotaExceededError" || /quota|espa[çc]o|storage/iu.test(error.message);
}

/**
 * Verifica se há versão nova.
 *
 * Só é chamada para quem ativou o download — a decisão fica em
 * `shouldCheckForUpdate`, não aqui, para que esta função seja testável sem
 * inventar estado de consentimento.
 *
 * `unchanged` e `current` são respostas diferentes: `unchanged` é o servidor
 * respondendo 304 ao ETag, sem reenviar o manifesto; `current` é o manifesto ter
 * vindo e a versão ser a mesma já instalada. As duas significam "não baixe", mas
 * só a primeira economizou a transferência do manifesto, e a interface precisa
 * poder dizer isso sem adivinhar.
 */
export async function checkForUpdate(
  source: OfflineSource,
  installed: InstallationRecord | null,
  etag: string | null,
): Promise<UpdateCheck> {
  // Sem instalação não existe manifesto local para acompanhar um 304.
  const response = await source.fetchManifest(installed ? etag : null);

  if (response.status === "unreachable") return offlineFailure("source_unreachable");
  if (response.status === "unchanged") {
    if (!installed) return offlineFailure("not_installed");
    return { ok: true, state: "unchanged", version: installed.version, etag: response.etag };
  }

  const verified = verifyManifest(response.parsed);
  if (!verified.ok) return verified;

  if (installed && installed.version === verified.manifest.version) {
    return { ok: true, state: "current", version: installed.version, etag: response.etag };
  }
  return {
    ok: true,
    state: "available",
    manifest: verified.manifest,
    installedVersion: installed?.version ?? null,
    etag: response.etag,
  };
}

/**
 * Quando verificar.
 *
 * Regra do produto: no login e a cada abertura da Bíblia conectada, **somente**
 * para quem ativou o download. O componente vive no layout da Bíblia, que
 * permanece montado entre capítulos; cada nova entrada verifica novamente.
 */
export function shouldCheckForUpdate(
  preference: PreferenceRecord | null,
  trigger: "login" | "bible_opened" | "reconnected",
  now: number,
): boolean {
  if (!preference?.enabled) return false;
  void trigger;
  void now;
  return true;
}

/** O validador só pode apontar para uma versão já instalada. */
export function installedManifestEtag(check: UpdateCheck): string | null {
  return check.ok && check.state !== "available" ? check.etag : null;
}

/**
 * Baixa e instala o pacote.
 *
 * Ordem das garantias, que é o que importa aqui:
 *
 * 1. sem consentimento registrado, não começa;
 * 2. cada arquivo é conferido por tamanho, hash, livro e versão **antes** de ir
 *    para o banco — resposta truncada, página de erro no lugar do JSON ou
 *    arquivo de outra versão não chegam ao armazenamento;
 * 3. os capítulos são gravados nas chaves da versão nova, que ninguém lê ainda;
 * 4. a instalação só é considerada feita depois de todos os 66 livros; faltando
 *    um, nada é promovido e o pacote anterior continua servindo;
 * 5. a troca é um registro só, e **condicionada** a o consentimento ainda
 *    valer no instante da troca — remoção feita durante o download vence;
 * 6. a limpeza das versões antigas vem depois da troca.
 *
 * Interromper no meio não corrompe nada: o que já foi verificado e gravado está
 * marcado, e a próxima tentativa só baixa o que falta.
 */
export async function installPackage(
  manifest: OfflineManifest,
  source: OfflineSource,
  store: OfflineStore,
  digest: Digest,
  options: {
    readonly preference: PreferenceRecord | null;
    readonly now: () => number;
    /**
     * Revisão da preferência lida antes de começar. A promoção só acontece se
     * a preferência ainda estiver nessa revisão: é assim que uma remoção feita
     * no meio do download não é desfeita pela troca.
     *
     * `undefined` usa a revisão da própria `preference`, que é o caso normal.
     */
    readonly expectedRevision?: number | null;
    readonly installed?: InstallationRecord | null;
    readonly onProgress?: (progress: InstallProgress) => void;
    readonly signal?: { readonly aborted: boolean };
  },
): Promise<InstallOutcome> {
  if (!options.preference?.enabled) return offlineFailure("consent_absent");
  if (manifest.schema !== OFFLINE_PACKAGE_SCHEMA) return offlineFailure("manifest_schema_unsupported");

  const staged = await store.stagedBooks(manifest.version);
  const resumedBooks = staged.size;
  let booksDone = resumedBooks;
  let bytesDone = manifest.files
    .filter((entry) => staged.has(entry.book))
    .reduce((total, entry) => total + entry.bytes, 0);

  const report = () =>
    options.onProgress?.({
      booksDone,
      booksTotal: manifest.files.length,
      bytesDone,
      bytesTotal: manifest.totals.bytes,
    });
  report();

  // Livros cujo texto não mudou são copiados do que já está no aparelho. Numa
  // correção de um livro só, isso é a diferença entre baixar 60 KB e 4 MB.
  const previous = options.installed ?? null;
  const plan = planUpdate(manifest, previous?.manifest ?? null);
  const reusableBooks = new Set(plan.reusable.map((entry) => entry.book));
  let reusedBooks = 0;
  let downloadedBytes = 0;

  for (const entry of manifest.files) {
    if (staged.has(entry.book)) continue;
    if (options.signal?.aborted) return offlineFailure("aborted");

    if (previous && reusableBooks.has(entry.book)) {
      try {
        await store.copyBook(previous.version, manifest.version, entry.book, entry.chapters);
        reusedBooks += 1;
        booksDone += 1;
        bytesDone += entry.bytes;
        report();
        continue;
      } catch (error) {
        // Instalação anterior incompleta ou ilegível: cai para o download, que
        // é o caminho seguro. Falta de espaço não se resolve baixando.
        if (storageFull(error)) return offlineFailure("storage_full");
      }
    }

    let installed = false;
    for (let attempt = 1; attempt <= ATTEMPTS_PER_BOOK && !installed; attempt += 1) {
      const response = await source.fetchBook(entry);
      if (response.status === "unreachable") {
        if (attempt === ATTEMPTS_PER_BOOK) return offlineFailure("source_unreachable");
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.text);
      } catch {
        // JSON inválido com tamanho e hash certos é impossível; com hash errado
        // o veredito abaixo é `hash_mismatch`, que é a informação verdadeira.
        parsed = null;
      }

      const checked = verifyBookFile(
        entry,
        manifest.version,
        response.bytes,
        await digest(response.text),
        parsed,
      );
      if (!checked.ok) {
        // Uma divergência de hash pode ser corrupção de rede ou cache
        // intermediário servindo coisa velha; vale uma segunda tentativa.
        // Persistindo, para: não se grava texto bíblico que não confere.
        if (attempt === ATTEMPTS_PER_BOOK) return checked;
        continue;
      }

      try {
        await store.stageBook(manifest.version, entry.book, checked.file.chapters);
      } catch (error) {
        return offlineFailure(storageFull(error) ? "storage_full" : "incomplete");
      }
      installed = true;
    }

    if (!installed) return offlineFailure("incomplete");
    booksDone += 1;
    bytesDone += entry.bytes;
    downloadedBytes += entry.bytes;
    report();
  }

  const complete = await store.stagedBooks(manifest.version);
  if (complete.size !== manifest.files.length) return offlineFailure("incomplete");

  // Última conferência do cancelamento, **antes** da troca.
  //
  // A verificação dentro do laço acontece no começo de cada livro, então quem
  // cancelasse durante o download do 66º livro via o pacote ser ativado de
  // qualquer forma: o laço terminava e a promoção seguia. O pacote estaria
  // íntegro, mas ativar o que a pessoa acabou de cancelar é desobedecer.
  // Os capítulos gravados ficam nas chaves da versão nova, que ninguém lê.
  if (options.signal?.aborted) return offlineFailure("aborted");

  const installation: InstallationRecord = {
    schema: OFFLINE_PACKAGE_SCHEMA,
    version: manifest.version,
    manifest,
    installedAt: options.now(),
    chapters: manifest.totals.chapters,
  };

  const expectedRevision =
    options.expectedRevision === undefined ? options.preference.revision : options.expectedRevision;

  try {
    const promoted = await store.promoteIfConsented(installation, expectedRevision);
    if (!promoted.ok) {
      // Dois casos, com reações diferentes em quem chama:
      //
      // - `consent_revoked`: a pessoa removeu ou desativou durante o download.
      //   Promover aqui seria ressuscitar o pacote que ela acabou de recusar.
      // - `preference_changed`: ninguém revogou nada; outra aba gravou a
      //   preferência (um ETag, uma verificação) e esta instalação está
      //   trabalhando sobre um estado que já não é o atual. Descartar e deixar
      //   o próximo gatilho recomeçar é o certo — apagar o que já estava
      //   instalado, não.
      //
      // Os capítulos permanecem para retomada; quem chama limpa apenas quando
      // uma recusa ainda vigente for confirmada por transação atômica.
      return offlineFailure(promoted.reason);
    }
  } catch (error) {
    return offlineFailure(storageFull(error) ? "storage_full" : "incomplete");
  }

  let prunedChapters = 0;
  try {
    prunedChapters = await store.pruneOtherVersions(manifest.version);
  } catch {
    // Órfãos ocupam espaço e são recuperáveis; a instalação está válida.
    prunedChapters = 0;
  }

  return { ok: true, installation, resumedBooks, reusedBooks, downloadedBytes, prunedChapters };
}
