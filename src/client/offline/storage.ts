import {
  OFFLINE_PACKAGE_SCHEMA,
  offlineManifestSchema,
  type OfflineManifest,
} from "../../domain/offline/package";

/**
 * Armazenamento local do pacote offline, em IndexedDB.
 *
 * **Por que as chaves levam a versão.** Cada capítulo é gravado como
 * `<versão>:<LIVRO>:<capítulo>`, e qual versão está em uso é um único registro
 * em `meta`. Isso é o que torna a troca atômica de graça: uma atualização grava
 * os capítulos novos ao lado dos antigos e só então troca **um** registro. Se a
 * rede cair, o espaço acabar ou um hash não bater no meio do caminho, o
 * ponteiro não se move e o pacote anterior continua servindo — não há janela em
 * que o leitor fique sem texto. A alternativa, apagar e reescrever, teria essa
 * janela e dependeria de uma transação de 1.189 escritas sobreviver inteira.
 *
 * **O que nunca entra aqui.** Só o corpus público. Nenhuma nota, marcação,
 * identificador de conta ou resposta autenticada: o banco é por origem e
 * compartilhado entre contas no mesmo aparelho, então misturar dado pessoal
 * aqui vazaria de uma conta para outra no mesmo navegador. Dado pessoal
 * continua em `src/server/reading/**` e no banco remoto, atrás de autenticação.
 */

const DATABASE_NAME = "samjoe-offline";
const DATABASE_VERSION = 1;

export const CHAPTERS_STORE = "chapters";
export const STAGING_STORE = "staging";
export const META_STORE = "meta";

const INSTALLATION_KEY = "installation";
const PREFERENCE_KEY = "preference";
const LEASE_KEY = "install-lease";

/**
 * Validade do arrendamento de instalação.
 *
 * Existe porque uma aba pode ser fechada no meio de uma instalação e não há
 * `finally` que sobreviva a isso. Sem prazo, o arrendamento abandonado
 * bloquearia o download para sempre. Dez minutos é folgado para os ~4 MB do
 * pacote em rede ruim e curto o bastante para não irritar quem fechou a aba e
 * voltou.
 *
 * O prazo tem um custo aceito: se uma instalação passar de dez minutos, outra
 * aba pode começar em paralelo. As chaves de capítulo são determinísticas e a
 * promoção é atômica, então o pior caso é trabalho repetido — nunca texto
 * misturado.
 */
export const INSTALL_LEASE_MS = 10 * 60 * 1000;

export type ChapterRecord = {
  readonly key: string;
  readonly book: string;
  readonly chapter: number;
  readonly verses: readonly string[];
};

export type InstallationRecord = {
  readonly schema: typeof OFFLINE_PACKAGE_SCHEMA;
  readonly version: string;
  readonly manifest: OfflineManifest;
  readonly installedAt: number;
  readonly chapters: number;
};

/**
 * Preferência da pessoa, separada da instalação de propósito.
 *
 * `enabled: false` é uma recusa registrada, não ausência de dado: o primeiro
 * download nunca começa sem `enabled: true`, e desativar continua valendo
 * depois de outro login, porque isto mora no aparelho e não na conta. Uma
 * conta diferente no mesmo navegador não herda consentimento nem o revoga.
 */
export type PreferenceRecord = {
  readonly enabled: boolean;
  readonly decidedAt: number;
  readonly lastCheckedAt: number | null;
  readonly lastKnownVersion: string | null;
  /**
   * ETag do manifesto na última consulta. Sem guardá-lo, toda verificação
   * rebaixaria os ~24 KB do manifesto; com ele, uma verificação sem mudança é
   * um 304 de algumas centenas de bytes. É o que a exigência de "não
   * retransmitir" significa na prática.
   */
  readonly lastEtag: string | null;
  /**
   * Contador que sobe a cada gravação da preferência.
   *
   * É o que resolve a corrida entre abas. Antes, o atualizador lia a
   * preferência, ia à rede e depois gravava `{...preference}` — a cópia velha.
   * Quem removesse o pacote na outra aba nesse intervalo via `enabled: true`
   * voltar sozinho e o pacote ser reinstalado. Com a revisão, a gravação do
   * atualizador é condicionada ao número que ele leu, e a remoção invalida
   * tudo que estava em voo.
   */
  readonly revision: number;
};

export type OfflineStore = {
  readInstallation(): Promise<InstallationRecord | null>;
  readPreference(): Promise<PreferenceRecord | null>;
  /**
   * Lê e grava a preferência **na mesma transação**, com a revisão esperada.
   *
   * `expectedRevision: null` significa "primeira decisão, não havia registro".
   * Devolve `{ ok: false }` quando outra aba gravou antes — quem perdeu a
   * corrida não sobrescreve, relê e decide.
   */
  updatePreference(
    expectedRevision: number | null,
    next: Omit<PreferenceRecord, "revision">,
  ): Promise<{ ok: true; preference: PreferenceRecord } | { ok: false; current: PreferenceRecord | null }>;
  readChapter(version: string, book: string, chapter: number): Promise<ChapterRecord | null>;
  stageBook(version: string, book: string, chapters: readonly (readonly string[])[]): Promise<void>;
  copyBook(fromVersion: string, toVersion: string, book: string, chapters: number): Promise<void>;
  stagedBooks(version: string): Promise<Set<string>>;
  /**
   * A troca, condicionada ao consentimento ainda valer.
   *
   * Confere a preferência e promove **na mesma transação**: não existe janela
   * entre "ainda está ativado" e "promovido". É o que impede que uma remoção
   * feita no último segundo de um download seja desfeita pela promoção.
   */
  promoteIfConsented(
    installation: InstallationRecord,
    expectedRevision: number | null,
  ): Promise<
    { ok: true } | { ok: false; reason: "consent_revoked" } | { ok: false; reason: "preference_changed" }
  >;
  /** Tenta tomar o arrendamento de instalação. `false` = outra aba está nisso. */
  acquireInstallLease(owner: string, now: number): Promise<boolean>;
  releaseInstallLease(owner: string): Promise<void>;
  pruneOtherVersions(keepVersion: string, now?: number): Promise<number>;
  /**
   * Apaga os capítulos e as marcas de uma versão **que não está ativa**.
   *
   * É a limpeza que substitui o `removeEverything()` do verificador. Uma
   * instalação que não chegou a ser promovida deixa capítulos sob as chaves da
   * versão nova; eles não são lidos por ninguém, mas ocupam espaço. Apagar
   * **essa versão** é limpeza de órfão; apagar o banco inteiro era apagar o
   * pacote de quem não pediu nada.
   *
   * Recusa com `active_installation` se a versão pedida for a instalada —
   * inclusive quando outra aba acabou de promover exatamente a mesma versão.
   */
  discardStagedVersion(
    version: string,
  ): Promise<{ ok: true; removed: number } | { ok: false; reason: "active_installation" }>;
  /**
   * Remoção condicionada: apaga tudo **somente** se a preferência ainda for a
   * recusa que esta aba gravou.
   *
   * `removeEverything()` incondicional tinha duas janelas. Se as três
   * tentativas de CAS da preferência falhassem, apagava de todo modo e a tela
   * dizia que tinha dado certo, sem `enabled: false` gravado. E, mesmo com a
   * gravação bem-sucedida, outra aba podia reativar e instalar entre a
   * gravação e a limpeza — e a limpeza apagava a instalação nova.
   *
   * Aqui a conferência e a mutação acontecem na mesma transação do IndexedDB:
   * ou a decisão mais recente continua sendo a recusa e tudo vai, ou nada é
   * apagado e quem pediu a remoção fica sabendo.
   */
  removeIfStillDisabled(
    expectedRevision: number,
  ): Promise<{ ok: true } | { ok: false; reason: "preference_changed" }>;
  close(): void;
};

function chapterKey(version: string, book: string, chapter: number): string {
  return `${version}:${book}:${chapter}`;
}

function stagingKey(version: string, book: string): string {
  return `${version}:${book}`;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB: operação recusada"));
  });
}

function finished(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB: transação abortada"));
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB: transação com erro"));
  });
}

export async function openOfflineStore(): Promise<OfflineStore> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(CHAPTERS_STORE)) db.createObjectStore(CHAPTERS_STORE);
      if (!db.objectStoreNames.contains(STAGING_STORE)) db.createObjectStore(STAGING_STORE);
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error("IndexedDB indisponível"));
    open.onblocked = () => reject(new Error("IndexedDB bloqueado por outra aba"));
  });

  return {
    async readInstallation() {
      const raw = await request(
        database.transaction(META_STORE, "readonly").objectStore(META_STORE).get(INSTALLATION_KEY),
      );
      if (!raw || typeof raw !== "object") return null;
      const candidate = raw as Partial<InstallationRecord>;
      // O registro é relido com o mesmo esquema do manifesto: um banco de uma
      // versão anterior do app, ou editado à mão, não vira texto na tela.
      const manifest = offlineManifestSchema.safeParse(candidate.manifest);
      if (!manifest.success) return null;
      if (typeof candidate.version !== "string" || candidate.version !== manifest.data.version) return null;
      if (typeof candidate.installedAt !== "number" || typeof candidate.chapters !== "number") return null;
      return {
        schema: OFFLINE_PACKAGE_SCHEMA,
        version: candidate.version,
        manifest: manifest.data,
        installedAt: candidate.installedAt,
        chapters: candidate.chapters,
      };
    },

    async readPreference() {
      const raw = await request(
        database.transaction(META_STORE, "readonly").objectStore(META_STORE).get(PREFERENCE_KEY),
      );
      if (!raw || typeof raw !== "object") return null;
      const candidate = raw as Partial<PreferenceRecord>;
      if (typeof candidate.enabled !== "boolean" || typeof candidate.decidedAt !== "number") return null;
      return {
        enabled: candidate.enabled,
        decidedAt: candidate.decidedAt,
        lastCheckedAt: typeof candidate.lastCheckedAt === "number" ? candidate.lastCheckedAt : null,
        lastKnownVersion:
          typeof candidate.lastKnownVersion === "string" ? candidate.lastKnownVersion : null,
        lastEtag: typeof candidate.lastEtag === "string" ? candidate.lastEtag : null,
        revision: typeof candidate.revision === "number" ? candidate.revision : 0,
      };
    },

    async updatePreference(expectedRevision, next) {
      const tx = database.transaction(META_STORE, "readwrite");
      const meta = tx.objectStore(META_STORE);

      // Ler e gravar sem `await` no meio é obrigatório: uma transação do
      // IndexedDB se encerra sozinha quando a fila de microtarefas esvazia sem
      // pedido pendente. Por isso o `put` sai de dentro do `onsuccess` do
      // `get`, e só o fim da transação é aguardado.
      let resultado: { ok: true; preference: PreferenceRecord } | { ok: false; current: PreferenceRecord | null } = {
        ok: false,
        current: null,
      };
      const leitura = meta.get(PREFERENCE_KEY);
      leitura.onsuccess = () => {
        const bruto = leitura.result;
        const atual =
          bruto && typeof bruto === "object" ? (bruto as Partial<PreferenceRecord>) : null;
        const revisaoAtual =
          atual === null ? null : typeof atual.revision === "number" ? atual.revision : 0;

        if (revisaoAtual !== expectedRevision) {
          resultado = {
            ok: false,
            current:
              atual === null || typeof atual.enabled !== "boolean" || typeof atual.decidedAt !== "number"
                ? null
                : {
                    enabled: atual.enabled,
                    decidedAt: atual.decidedAt,
                    lastCheckedAt: typeof atual.lastCheckedAt === "number" ? atual.lastCheckedAt : null,
                    lastKnownVersion:
                      typeof atual.lastKnownVersion === "string" ? atual.lastKnownVersion : null,
                    lastEtag: typeof atual.lastEtag === "string" ? atual.lastEtag : null,
                    revision: revisaoAtual ?? 0,
                  },
          };
          tx.abort();
          return;
        }

        const gravada: PreferenceRecord = { ...next, revision: (revisaoAtual ?? -1) + 1 };
        meta.put(gravada, PREFERENCE_KEY);
        resultado = { ok: true, preference: gravada };
      };

      try {
        await finished(tx);
      } catch {
        // Abortada de propósito quando a revisão não bate; `resultado` já diz.
        if (resultado.ok) throw new Error("IndexedDB: gravação da preferência abortada");
      }
      return resultado;
    },

    async readChapter(version, book, chapter) {
      const raw = await request(
        database
          .transaction(CHAPTERS_STORE, "readonly")
          .objectStore(CHAPTERS_STORE)
          .get(chapterKey(version, book, chapter)),
      );
      if (!raw || typeof raw !== "object") return null;
      const candidate = raw as Partial<ChapterRecord>;
      if (!Array.isArray(candidate.verses) || candidate.verses.length === 0) return null;
      if (candidate.verses.some((verse) => typeof verse !== "string" || verse.length === 0)) return null;
      return {
        key: chapterKey(version, book, chapter),
        book,
        chapter,
        verses: candidate.verses,
      };
    },

    /**
     * Grava um livro já verificado. Os capítulos vão direto para as chaves
     * definitivas da versão nova — que ninguém lê enquanto o ponteiro não
     * trocar — e o livro é marcado em `staging` na mesma transação. Marcar na
     * mesma transação é o que permite retomar: ou o livro está inteiro e
     * marcado, ou não está marcado e é baixado de novo.
     */
    async stageBook(version, book, chapters) {
      const tx = database.transaction([CHAPTERS_STORE, STAGING_STORE], "readwrite");
      const store = tx.objectStore(CHAPTERS_STORE);
      chapters.forEach((verses, index) => {
        store.put({ book, chapter: index + 1, verses }, chapterKey(version, book, index + 1));
      });
      tx.objectStore(STAGING_STORE).put(
        { book, chapters: chapters.length, stagedAt: Date.now() },
        stagingKey(version, book),
      );
      await finished(tx);
    },

    /**
     * Copia um livro da instalação anterior para a versão nova, sem rede.
     *
     * Quem decide que a cópia é legítima é `planUpdate`, comparando o hash do
     * texto; aqui só se confere que a quantidade de capítulos gravados é a
     * esperada e se **falha** se não for. Copiar capítulo faltando produziria um
     * pacote "completo" com buraco no meio, que é pior que não atualizar.
     *
     * **Duas transações, e isso não é detalhe.** A primeira versão lia capítulo
     * a capítulo com `await` entre as requisições, dentro de uma única
     * transação de escrita. Em IndexedDB a transação encerra sozinha quando a
     * fila de microtarefas esvazia sem requisição nova, então esperar por uma
     * promessa no meio dela a torna inativa — e, enquanto não encerra, segura
     * o repositório inteiro. Em Gênesis eram 50 idas e voltas em série; no
     * pacote todo, 1.189. Aqui a leitura é **uma** requisição `getAll` sobre a
     * faixa de chaves do livro, e a escrita é outra transação, enfileirada de
     * uma vez só.
     */
    async copyBook(fromVersion, toVersion, book, chapters) {
      const prefix = `${fromVersion}:${book}:`;
      const range = IDBKeyRange.bound(prefix, `${prefix}￿`);
      const existing = await request(
        database.transaction(CHAPTERS_STORE, "readonly").objectStore(CHAPTERS_STORE).getAll(range),
      );

      const verses = new Map<number, readonly string[]>();
      for (const row of existing) {
        if (!row || typeof row !== "object") continue;
        const record = row as Partial<ChapterRecord>;
        if (typeof record.chapter !== "number") continue;
        if (!Array.isArray(record.verses) || record.verses.length === 0) continue;
        verses.set(record.chapter, record.verses);
      }

      for (let chapter = 1; chapter <= chapters; chapter += 1) {
        if (!verses.has(chapter)) {
          throw new Error(
            `${book}: capítulo ${chapter} ausente na instalação anterior; cópia local recusada`,
          );
        }
      }

      const tx = database.transaction([CHAPTERS_STORE, STAGING_STORE], "readwrite");
      const store = tx.objectStore(CHAPTERS_STORE);
      for (let chapter = 1; chapter <= chapters; chapter += 1) {
        store.put({ book, chapter, verses: verses.get(chapter) }, chapterKey(toVersion, book, chapter));
      }
      tx.objectStore(STAGING_STORE).put(
        { book, chapters, stagedAt: Date.now() },
        stagingKey(toVersion, book),
      );
      await finished(tx);
    },

    async stagedBooks(version) {
      const keys = await request(
        database.transaction(STAGING_STORE, "readonly").objectStore(STAGING_STORE).getAllKeys(),
      );
      const prefix = `${version}:`;
      const books = new Set<string>();
      for (const key of keys) {
        if (typeof key === "string" && key.startsWith(prefix)) books.add(key.slice(prefix.length));
      }
      return books;
    },

    /**
     * A troca. Um único `put` no registro de instalação, e a partir dele o
     * leitor passa a servir a versão nova. Limpar `staging` na mesma transação
     * é seguro: se a transação abortar, nada muda — nem o ponteiro, nem as
     * marcas de retomada.
     */
    async promoteIfConsented(installation, expectedRevision) {
      const tx = database.transaction([META_STORE, STAGING_STORE], "readwrite");
      const meta = tx.objectStore(META_STORE);

      let recusa: "consent_revoked" | "preference_changed" | null = null;
      const leitura = meta.get(PREFERENCE_KEY);
      leitura.onsuccess = () => {
        const bruto = leitura.result;
        const atual = bruto && typeof bruto === "object" ? (bruto as Partial<PreferenceRecord>) : null;
        const revisaoAtual = atual === null ? null : typeof atual.revision === "number" ? atual.revision : 0;

        // Duas condições, as duas necessárias: continuar ativado e ninguém ter
        // mexido na preferência desde que esta instalação começou. A remoção
        // grava `enabled: false` e sobe a revisão, então pega nas duas.
        //
        // **Os dois motivos são distintos e isso não é detalhe de nomenclatura.**
        // Quem não consentiu mais quer que nada reste; quem apenas gravou um
        // ETag noutra aba não pediu nada. Devolver o mesmo motivo nos dois casos
        // foi o que fez o verificador apagar pacote instalado por mudança de
        // metadados.
        if (atual?.enabled !== true) {
          recusa = "consent_revoked";
          tx.abort();
          return;
        }
        if (revisaoAtual !== expectedRevision) {
          recusa = "preference_changed";
          tx.abort();
          return;
        }
        meta.put(installation, INSTALLATION_KEY);
        // Só as marcas desta versão. Limpar o `staging` inteiro destruiria as
        // marcas de retomada de um instalador concorrente de outra versão, que
        // teria de baixar tudo de novo sem motivo.
        const prefixo = `${installation.version}:`;
        tx.objectStore(STAGING_STORE).delete(IDBKeyRange.bound(prefixo, `${prefixo}￿`));
      };

      try {
        await finished(tx);
      } catch (error) {
        if (recusa !== null) return { ok: false, reason: recusa };
        throw error;
      }
      return recusa !== null ? { ok: false, reason: recusa } : { ok: true };
    },

    /**
     * Arrendamento por compare-and-set numa única transação.
     *
     * Substitui a dependência de `navigator.locks`, que resolvia só uma metade
     * do problema: o bloqueio de instalação não era pedido pela remoção, então
     * remover e instalar nunca se viam. A instalação usa o arrendamento; a
     * remoção e a promoção coordenam-se por revisão atômica da preferência.
     */
    async acquireInstallLease(owner, now) {
      const tx = database.transaction(META_STORE, "readwrite");
      const meta = tx.objectStore(META_STORE);

      let tomado = false;
      const leitura = meta.get(LEASE_KEY);
      leitura.onsuccess = () => {
        const bruto = leitura.result;
        const atual =
          bruto && typeof bruto === "object"
            ? (bruto as { owner?: unknown; expiresAt?: unknown })
            : null;
        const expira = typeof atual?.expiresAt === "number" ? atual.expiresAt : 0;
        const dono = typeof atual?.owner === "string" ? atual.owner : null;

        // Renovar o próprio arrendamento é permitido; o de outra aba só depois
        // de vencer, para que uma aba fechada no meio não bloqueie para sempre.
        if (dono !== null && dono !== owner && expira > now) return;

        meta.put({ owner, expiresAt: now + INSTALL_LEASE_MS }, LEASE_KEY);
        tomado = true;
      };

      await finished(tx);
      return tomado;
    },

    async releaseInstallLease(owner) {
      const tx = database.transaction(META_STORE, "readwrite");
      const meta = tx.objectStore(META_STORE);
      const leitura = meta.get(LEASE_KEY);
      leitura.onsuccess = () => {
        const bruto = leitura.result;
        const dono =
          bruto && typeof bruto === "object" && typeof (bruto as { owner?: unknown }).owner === "string"
            ? (bruto as { owner: string }).owner
            : null;
        // Só o dono solta. Soltar o arrendamento de outra aba reabriria a
        // corrida que este mecanismo existe para fechar.
        if (dono === owner) meta.delete(LEASE_KEY);
      };
      await finished(tx);
    },

    /**
     * Apaga capítulos de versões que não a ativa. Roda **depois** da troca, de
     * propósito: uma falha aqui deixa registros órfãos ocupando espaço, o que é
     * recuperável, enquanto apagar antes deixaria o leitor sem texto.
     */
    async pruneOtherVersions(keepVersion) {
      const tx = database.transaction([META_STORE, STAGING_STORE, CHAPTERS_STORE], "readwrite");

      // Três guardas, todas na mesma transação, porque poda é a operação que
      // mais fácil apaga o que não devia:
      //
      // 1. só poda se `keepVersion` for de fato a instalação ativa. Podar
      //    "mantendo" uma versão que não é a instalada apagaria o pacote que
      //    está sendo lido;
      // 2. nunca toca na versão ativa;
      // 3. poupa todas as versões com marca de `staging`. O arrendamento pode
      //    vencer durante um download ainda ativo, e a idade de uma marca não
      //    prova que a instalação parou. Resíduos podem ocupar espaço até a
      //    remoção explícita do pacote, mas não quebram uma retomada em curso.
      let recusado = false;
      let removed = 0;
      const instalacao = tx.objectStore(META_STORE).get(INSTALLATION_KEY);
      instalacao.onsuccess = () => {
        const bruto = instalacao.result;
        const ativa =
          bruto && typeof bruto === "object" && typeof (bruto as { version?: unknown }).version === "string"
            ? (bruto as { version: string }).version
            : null;
        if (ativa !== keepVersion) {
          recusado = true;
          tx.abort();
          return;
        }

        const staging = tx.objectStore(STAGING_STORE);
        const chaves = staging.getAllKeys();
        const emObra = new Set<string>();
        chaves.onsuccess = () => {
          const lista = chaves.result;
          lista.forEach((key) => {
            if (typeof key !== "string") return;
            const corte = key.indexOf(":");
            if (corte <= 0) return;
            const versao = key.slice(0, corte);
            if (versao === keepVersion) return;
            emObra.add(versao);
          });

          const chapters = tx.objectStore(CHAPTERS_STORE);
          const capitulos = chapters.getAllKeys();
          capitulos.onsuccess = () => {
            for (const key of capitulos.result) {
              if (typeof key !== "string") continue;
              const corte = key.indexOf(":");
              if (corte <= 0) continue;
              const versao = key.slice(0, corte);
              if (versao === keepVersion || emObra.has(versao)) continue;
              chapters.delete(key);
              removed += 1;
            }
          };
        };
      };

      try {
        await finished(tx);
      } catch (error) {
        if (recusado) return 0;
        throw error;
      }
      return removed;
    },

    async discardStagedVersion(version) {
      const tx = database.transaction([META_STORE, STAGING_STORE, CHAPTERS_STORE], "readwrite");

      let recusado = false;
      let removed = 0;
      const instalacao = tx.objectStore(META_STORE).get(INSTALLATION_KEY);
      instalacao.onsuccess = () => {
        const bruto = instalacao.result;
        const ativa =
          bruto && typeof bruto === "object" && typeof (bruto as { version?: unknown }).version === "string"
            ? (bruto as { version: string }).version
            : null;
        // A versão que eu ia instalar pode ter sido promovida por outra aba
        // enquanto eu falhava. Nesse caso ela deixou de ser resíduo e passou a
        // ser o pacote da pessoa.
        if (ativa === version) {
          recusado = true;
          tx.abort();
          return;
        }

        const prefixo = `${version}:`;
        const faixa = IDBKeyRange.bound(prefixo, `${prefixo}￿`);
        const chapters = tx.objectStore(CHAPTERS_STORE);
        const contagem = chapters.count(faixa);
        contagem.onsuccess = () => {
          removed = contagem.result;
          chapters.delete(faixa);
          tx.objectStore(STAGING_STORE).delete(faixa);
        };
      };

      try {
        await finished(tx);
      } catch (error) {
        if (recusado) return { ok: false, reason: "active_installation" };
        throw error;
      }
      return recusado ? { ok: false, reason: "active_installation" } : { ok: true, removed };
    },

    async removeIfStillDisabled(expectedRevision) {
      const tx = database.transaction([CHAPTERS_STORE, STAGING_STORE, META_STORE], "readwrite");
      const meta = tx.objectStore(META_STORE);

      let conflito = false;
      const leitura = meta.get(PREFERENCE_KEY);
      leitura.onsuccess = () => {
        const bruto = leitura.result;
        const atual = bruto && typeof bruto === "object" ? (bruto as Partial<PreferenceRecord>) : null;
        const revisaoAtual = atual === null ? null : typeof atual.revision === "number" ? atual.revision : 0;

        // A recusa tem de ser a decisão **mais recente**. Se outra aba reativou
        // e instalou nesse intervalo, a instalação dela é legítima e não é esta
        // remoção que a desfaz.
        if (atual?.enabled !== false || revisaoAtual !== expectedRevision) {
          conflito = true;
          tx.abort();
          return;
        }

        tx.objectStore(CHAPTERS_STORE).clear();
        tx.objectStore(STAGING_STORE).clear();
        // A preferência sobrevive à remoção do pacote: quem removeu decidiu não
        // ter o download, e esquecer isso faria o app voltar a oferecer sozinho.
        meta.delete(INSTALLATION_KEY);
      };

      try {
        await finished(tx);
      } catch (error) {
        if (conflito) return { ok: false, reason: "preference_changed" };
        throw error;
      }
      return conflito ? { ok: false, reason: "preference_changed" } : { ok: true };
    },

    close() {
      database.close();
    },
  };
}

/**
 * Identificador desta aba, para o arrendamento.
 *
 * Não identifica a pessoa nem a conta: é um número aleatório de vida curta,
 * usado só para saber se o arrendamento é meu. Nada disso sai do aparelho.
 */
export function newLeaseOwner(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Executa instalações com exclusão mútua entre abas enquanto o prazo vigora.
 *
 * Substitui o `withInstallLock` baseado em `navigator.locks`. O problema do
 * anterior não era o navegador sem suporte — era que só a instalação pedia o
 * bloqueio: a remoção não solicitava o mesmo mecanismo. Agora ela não espera o
 * download e se coordena com a promoção pela revisão no IndexedDB.
 *
 * Solta o arrendamento mesmo quando `run` lança, senão uma falha de rede
 * deixaria o download travado até o prazo vencer.
 */
export async function withInstallLease<T>(
  store: Pick<OfflineStore, "acquireInstallLease" | "releaseInstallLease">,
  run: () => Promise<T>,
  onBusy: () => T,
  now: () => number = () => Date.now(),
): Promise<T> {
  const owner = newLeaseOwner();
  if (!(await store.acquireInstallLease(owner, now()))) return onBusy();
  try {
    return await run();
  } finally {
    await store.releaseInstallLease(owner);
  }
}
