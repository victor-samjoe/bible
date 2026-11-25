/**
 * Registro versionado das fontes lexicais (LEXICON-INDEX-001, fila C30).
 *
 * Este arquivo é o **contrato**: declara, por fonte, o que pode ser baixado, o
 * que pode ser lido de dentro do arquivo baixado e o que é proibido ler. Ele é
 * versionado no Git; os bytes das fontes **não são** — ficam em
 * `data/sources/lexicons/`, que o `.gitignore` mantém fora do repositório e
 * fora do bundle, exatamente como já é feito com os corpora em
 * `data/sources/originals/` (ver `docs/ORIGINAL_LANGUAGE_SOURCES.md`).
 *
 * Princípios que o código abaixo faz valer, e não apenas documenta:
 *
 * 1. **Campo não declarado não é importado.** Os parsers só enxergam colunas e
 *    elementos listados em `selectedFields`; qualquer outro é ignorado e
 *    relatado. `prohibitedFields` vai além: se a coluna existir no arquivo, a
 *    leitura falha fechada em vez de simplesmente ignorar (caso do `Meaning` do
 *    TBESH — ver `PROHIBITED_TBESH_MEANING_REASON`).
 * 2. **Sem mistura de licença.** CC BY 4.0 e CC BY-SA 4.0 não convivem no mesmo
 *    conjunto importado, porque a obrigação de compartilhar pela mesma licença
 *    contaminaria o derivado inteiro. `assertNoLicenseMixing` recusa.
 * 3. **Sem pino, sem coleta.** Enquanto o commit não for resolvido e os
 *    SHA-256 não forem registrados, a fonte não tem URL de download: a função
 *    que monta a URL exige um pino resolvido.
 *
 * Módulo puro: sem `node:*`, sem rede, sem filesystem. Pode rodar no Worker.
 */

export const LEXICON_REGISTRY_VERSION = "2026-11-19.3";

export type LexiconLanguage = "hbo" | "grc";

/** O que a fonte está autorizada a fornecer. */
export type LexiconAssetKind =
  /** Verbete por lema: o que a palavra pode significar. */
  | "lexical_entry"
  /** Anotação por ocorrência: que sentido a palavra assume naquele versículo. */
  | "occurrence_annotation"
  /** Só referência de formato/pipeline. Nenhum dado é importado. */
  | "pipeline_reference";

export type LicenseFamily =
  | "cc-by-4.0"
  | "cc-by-sa-4.0"
  | "public-domain"
  | "mit"
  | "permission-required";

/**
 * Pino da versão. `unresolved` é um estado honesto e explícito: nenhuma destas
 * fontes foi coletada ainda, portanto não existe commit conferido para gravar
 * aqui. Inventar um hash seria pior do que admitir que ele falta.
 */
export type SourcePin =
  | { readonly kind: "commit"; readonly commit: string }
  | { readonly kind: "tag"; readonly tag: string; readonly commit: string }
  | { readonly kind: "unresolved"; readonly reason: string };

export type SelectedField = {
  /** Nome exato da coluna/elemento no arquivo da fonte. */
  readonly sourceField: string;
  /** Campo do nosso registro normalizado que ele alimenta. */
  readonly target: string;
  /** Por que este campo é necessário ao produto. */
  readonly purpose: string;
  /** `true` quando a ausência do campo no arquivo deve interromper a leitura. */
  readonly required: boolean;
};

export type ProhibitedField = {
  readonly sourceField: string;
  readonly reason: string;
  readonly evidenceUrl: string;
};

export type LexiconAsset = {
  /** Caminho relativo dentro do repositório da fonte. */
  readonly repoPath: string;
  /** Caminho local, relativo a `data/sources/lexicons/<id>/`. */
  readonly localPath: string;
  readonly format: "tsv" | "xml" | "text" | "license";
  /**
   * `true` quando o arquivo é versionado por Git LFS. Confirmado em 19/11/2026
   * para `WLC/tsv/macula-hebrew.tsv`: o `raw.githubusercontent.com` devolve um
   * ponteiro de 133 bytes (`version https://git-lfs.github.com/spec/v1`), não o
   * dado de 84 MB. Gravar esse ponteiro e congelar o SHA-256 dele produziria um
   * pino que confere para sempre e nunca aponta para o conteúdo. Ativos LFS são
   * baixados por `media.githubusercontent.com/media/...`, e o coletor recusa um
   * corpo que ainda tenha a cara de ponteiro.
   */
  readonly lfs?: boolean;
  /**
   * SHA-256 dos bytes oficiais. `null` enquanto a coleta não aconteceu: a
   * primeira coleta grava o hash no lock local e imprime a linha para ser
   * colada aqui, congelando a versão. A partir daí, divergência falha fechada.
   */
  readonly expectedSha256: string | null;
  /**
   * `false` enquanto o caminho dentro do repositório ainda não foi conferido
   * contra a árvore real. O coletor falha fechado se o arquivo não existir.
   */
  readonly pathConfirmed: boolean;
  /**
   * Estado do leitor para este arquivo:
   * - `parsed`: existe parser implementado e testado com fixture;
   * - `evidence_only`: guardado como prova de licença, nunca lido como dado;
   * - `pending_parser`: declarado, coletável, ainda sem parser — não entra no
   *   índice e o verificador o reporta como pendência, em vez de ignorá-lo.
   */
  readonly readerStatus: "parsed" | "evidence_only" | "pending_parser";
};

export type CollectionStatus =
  /** Documentada e recomendada, mas o proprietário ainda não liberou a coleta. */
  | "awaiting_owner_approval"
  /** Coleta liberada por decisão registrada. */
  | "approved_for_collection"
  /** Proibida enquanto a pendência de direitos não for resolvida. */
  | "blocked";

/**
 * Aprovação do proprietário para coletar uma fonte. É dado, não comentário: o
 * coletor exige `collectionStatus === "approved_for_collection"`, e este
 * registro diz **quem** aprovou, **quando** e **o que** foi aprovado, para que
 * a decisão possa ser auditada depois sem depender da memória de ninguém.
 *
 * Aprovar a coleta não aprova a exibição. O manifesto gravado pelo coletor
 * continua nascendo como `collected_pending_human_approval`, e o verbete só
 * chega ao leitor depois da revisão editorial descrita em
 * `translation-workflow.ts`.
 */
export type CollectionApproval = {
  /** Quem decidiu. Papel, não dado pessoal. */
  readonly approvedBy: string;
  /** Data da decisão, ISO `YYYY-MM-DD`. */
  readonly approvedAt: string;
  /** O que exatamente foi liberado, nas palavras da decisão. */
  readonly scope: string;
};

export type LexiconSource = {
  readonly id: string;
  readonly name: string;
  readonly language: LexiconLanguage | "multi";
  readonly assetKind: LexiconAssetKind;
  readonly homepage: string;
  /** Repositório canônico, usado para montar as URLs fixadas por commit. */
  readonly repository: string;
  readonly defaultBranch: string;
  readonly pin: SourcePin;
  readonly license: {
    readonly declared: string;
    readonly family: LicenseFamily;
    readonly url: string;
  };
  readonly attribution: string;
  readonly collectionStatus: CollectionStatus;
  /**
   * Presente somente quando `collectionStatus === "approved_for_collection"`.
   * A invariante é verificada em teste: status aprovado sem aprovação nomeada
   * é exatamente o buraco de auditoria que este campo existe para fechar.
   */
  readonly approval?: CollectionApproval;
  /** `false` = nada desta fonte vira registro nosso, nem mesmo um campo. */
  readonly importable: boolean;
  readonly assets: readonly LexiconAsset[];
  readonly selectedFields: readonly SelectedField[];
  readonly prohibitedFields: readonly ProhibitedField[];
  readonly notes: readonly string[];
};

export const PROHIBITED_TBESH_MEANING_REASON =
  "O cabeçalho do próprio TBESH distingue duas colunas: 'Gloss', criada pelos estudiosos da " +
  "Tyndale House, e 'Meaning', derivada do Abridged BDB publicado pelo Online Bible, para a qual " +
  "o cabeçalho pede que se obtenha permissão antes de reutilizar em outro projeto. CC BY 4.0 no " +
  "pacote não substitui essa permissão, porque quem licencia o pacote não é o titular daquele " +
  "texto específico. Enquanto a permissão não existir por escrito, 'Meaning' não é lida, não é " +
  "gravada e não é exibida; a definição hebraica vem do Open Scriptures HebrewLexicon.";

const TBESH_HEADER_EVIDENCE =
  "https://github.com/STEPBible/STEPBible-Data/tree/master/Lexicons";

/**
 * Aprovação registrada em 19/11/2026 para as quatro fontes do MVP. Alcança a
 * coleta dos bytes públicos e a montagem do índice; **não** alcança exibir
 * verbete sem a revisão editorial, nem a coluna `Meaning` do TBESH, que segue
 * bloqueada por falta de permissão específica.
 */
const OWNER_APPROVAL_2026_11_19: CollectionApproval = {
  approvedBy: "proprietário do projeto",
  approvedAt: "2026-11-19",
  scope:
    "Coleta das fontes lexicais do MVP (MACULA Hebrew e Greek, Open Scriptures HebrewLexicon e " +
    "STEPBible TBESG), congelamento dos SHA-256 e montagem do índice. Não aprova exibição de " +
    "verbete sem revisão editorial nem altera o bloqueio do TBESH.",
};

/**
 * Entradas do registro.
 *
 * As quatro fontes do MVP foram aprovadas para coleta em 19/11/2026 e estão
 * fixadas no HEAD daquele dia. As demais continuam `awaiting_owner_approval`
 * (TFLSJ, fora do MVP; Clear Bible Alignments, só referência de formato) ou
 * `blocked` (TBESH, pendência de permissão). Ver `docs/LEXICON_PIPELINE.md`.
 *
 * Três caminhos declarados na fase de preparação estavam errados e foram
 * corrigidos contra a árvore real, que é exatamente o que `pathConfirmed:
 * false` existia para sinalizar:
 * - `macula-hebrew`: `TSV/macula-hebrew.tsv` → `WLC/tsv/macula-hebrew.tsv`,
 *   e o arquivo é Git LFS;
 * - `oshb-hebrewlexicon`: não há `LICENSE`; a prova é o `readme.md`.
 */
export const LEXICON_SOURCES: readonly LexiconSource[] = [
  {
    id: "macula-hebrew",
    name: "MACULA Hebrew (Clear Bible)",
    language: "hbo",
    assetKind: "occurrence_annotation",
    homepage: "https://github.com/Clear-Bible/macula-hebrew",
    repository: "https://github.com/Clear-Bible/macula-hebrew",
    defaultBranch: "main",
    // HEAD de `main` em 19/11/2026, conferido pela API de refs do GitHub.
    pin: { kind: "commit", commit: "47db250bd55d0d8577f2a94fba114ef16c35b23c" },
    license: {
      declared: "CC BY 4.0",
      family: "cc-by-4.0",
      url: "https://github.com/Clear-Bible/macula-hebrew/blob/main/LICENSE.md",
    },
    attribution:
      "MACULA Hebrew Linguistic Datasets, Clear Bible, Inc., sob CC BY 4.0, com indicação das " +
      "modificações feitas pela Bíblia Bereana.",
    collectionStatus: "approved_for_collection",
    approval: OWNER_APPROVAL_2026_11_19,
    importable: true,
    assets: [
      { repoPath: "LICENSE.md", localPath: "LICENSE.md", format: "license", expectedSha256: "df45ba3224e7d6f9dba3ec8fd2d0b3f1d2febb2620147c889667886fccd4d8e1", pathConfirmed: true, readerStatus: "evidence_only" },
      // O caminho declarado na preparação (`TSV/macula-hebrew.tsv`) não existe
      // na árvore: devolve 404. O arquivo real está em `WLC/tsv/` e é LFS.
      // O hash abaixo é igual ao `oid` do ponteiro LFS, o que confirma que os
      // 84 MB coletados são o objeto apontado, e não o ponteiro.
      { repoPath: "WLC/tsv/macula-hebrew.tsv", localPath: "macula-hebrew.tsv", format: "tsv", lfs: true, expectedSha256: "965cb0599beed2fe31283b615bcc369178141c0e718a66d97518d94309cfc124", pathConfirmed: true, readerStatus: "parsed" },
    ],
    selectedFields: [
      { sourceField: "xml:id", target: "occurrence.sourceWordId", purpose: "identificador estável da ocorrência na fonte", required: true },
      { sourceField: "ref", target: "occurrence.canonicalRef", purpose: "âncora canônica livro/capítulo/versículo", required: true },
      { sourceField: "text", target: "occurrence.surface", purpose: "forma exibida da palavra na ocorrência", required: true },
      { sourceField: "lemma", target: "occurrence.lemma", purpose: "lema que liga a ocorrência ao verbete", required: true },
      // Glossa **por ocorrência**: curta e contextual ("in", "beginning",
      // "he.created"), ao contrário da glossa do verbete de Strong, que é uma
      // lista de usos da KJV. É esta que o leitor mostra ao clicar na palavra,
      // e é ela que a tradução editorial para pt-BR toma como texto-fonte.
      { sourceField: "gloss", target: "occurrence.gloss", purpose: "glossa contextual, texto-fonte da tradução editorial", required: false },
      // Conferido contra o cabeçalho real em 19/11/2026: não existe coluna
      // `strong` no MACULA Hebrew. O Strong aumentado está em `strongnumberx`
      // ("0871a", "7225"), e `stronglemma` guarda a forma, não o número.
      { sourceField: "strongnumberx", target: "occurrence.strongId", purpose: "chave de índice por lema", required: true },
      { sourceField: "morph", target: "occurrence.morphology", purpose: "código morfológico publicado pela fonte", required: false },
      { sourceField: "pos", target: "occurrence.partOfSpeech", purpose: "classe gramatical da ocorrência", required: false },
      // O arquivo traz três domínios (`lexdomain`, `contextualdomain`,
      // `coredomain`). Importamos só o `coredomain`, que é o estável por lema;
      // os outros dois variam por ocorrência e entram em frente própria. Os
      // dois ignorados aparecem no relatório de campos não declarados.
      { sourceField: "coredomain", target: "occurrence.semanticDomain", purpose: "domínio semântico anotado", required: false },
      // Importados em 19/11 depois de medir o que estava sendo jogado fora:
      // `sdbh` tem 244.734 linhas preenchidas e `lexdomain` 244.721, contra
      // 160.923 do `coredomain`. `sdbh` é a chave do Semantic Dictionary of
      // Biblical Hebrew, que **nomeia** a acepção; `coredomain` dá só o código
      // do domínio estável. Guardar os dois permite dizer qual sentido a
      // palavra assume aqui, em vez de apenas que ela tem vários.
      { sourceField: "sdbh", target: "occurrence.sdbhSense", purpose: "acepção no Semantic Dictionary of Biblical Hebrew", required: false },
      { sourceField: "lexdomain", target: "occurrence.lexicalDomain", purpose: "domínio lexical anotado pela fonte", required: false },
      { sourceField: "sensenumber", target: "occurrence.senseNumber", purpose: "sentido escolhido nesta ocorrência", required: false },
      { sourceField: "frame", target: "occurrence.semanticFrame", purpose: "papéis semânticos anotados", required: false },
    ],
    prohibitedFields: [],
    notes: [
      "Fornece o sentido *nesta ocorrência*; não substitui o verbete.",
      "Não é fonte de texto-base: o hebraico exibido continua vindo do MorphHB já importado.",
      "O arquivo é Git LFS: 84 MB reais atrás de um ponteiro de 133 bytes no raw.",
    ],
  },
  {
    id: "macula-greek",
    name: "MACULA Greek (Clear Bible)",
    language: "grc",
    assetKind: "occurrence_annotation",
    homepage: "https://github.com/Clear-Bible/macula-greek",
    repository: "https://github.com/Clear-Bible/macula-greek",
    defaultBranch: "main",
    // HEAD de `main` em 19/11/2026, conferido pela API de refs do GitHub.
    pin: { kind: "commit", commit: "8423afe47b9e8f24b7772e808af45c7159a6fe7e" },
    license: {
      declared: "CC BY 4.0",
      family: "cc-by-4.0",
      url: "https://github.com/Clear-Bible/macula-greek/blob/main/LICENSE.md",
    },
    attribution:
      "MACULA Greek Linguistic Datasets, Clear Bible, Inc., sob CC BY 4.0, com indicação das " +
      "modificações feitas pela Bíblia Bereana.",
    collectionStatus: "approved_for_collection",
    approval: OWNER_APPROVAL_2026_11_19,
    importable: true,
    assets: [
      { repoPath: "LICENSE.md", localPath: "LICENSE.md", format: "license", expectedSha256: "41b49a2387b628a7bc772ddfae3a8af9dd8f4d4470b27b6132f6da6c73e4a557", pathConfirmed: true, readerStatus: "evidence_only" },
      { repoPath: "SBLGNT/tsv/macula-greek-SBLGNT.tsv", localPath: "macula-greek-SBLGNT.tsv", format: "tsv", expectedSha256: "7f71504fdee8659bdd9f85342e4103d645864c2851b8205915bb298f0c004cc5", pathConfirmed: true, readerStatus: "parsed" },
    ],
    selectedFields: [
      { sourceField: "xml:id", target: "occurrence.sourceWordId", purpose: "identificador estável da ocorrência na fonte", required: true },
      { sourceField: "ref", target: "occurrence.canonicalRef", purpose: "âncora canônica livro/capítulo/versículo", required: true },
      { sourceField: "text", target: "occurrence.surface", purpose: "forma exibida da palavra na ocorrência", required: true },
      { sourceField: "lemma", target: "occurrence.lemma", purpose: "lema que liga a ocorrência ao verbete", required: true },
      { sourceField: "strong", target: "occurrence.strongId", purpose: "chave de índice por lema", required: true },
      { sourceField: "gloss", target: "occurrence.gloss", purpose: "glossa contextual, texto-fonte da tradução editorial", required: false },
      { sourceField: "morph", target: "occurrence.morphology", purpose: "código morfológico publicado pela fonte", required: false },
      // Conferido contra o cabeçalho real em 19/11/2026: o lado grego chama de
      // `class` o que o lado hebraico chama de `pos`, e não publica
      // `sensenumber`. Declarar `sensenumber` aqui seria descrever um arquivo
      // que não existe.
      { sourceField: "class", target: "occurrence.partOfSpeech", purpose: "classe gramatical da ocorrência", required: false },
      { sourceField: "domain", target: "occurrence.semanticDomain", purpose: "domínio semântico anotado", required: false },
      { sourceField: "frame", target: "occurrence.semanticFrame", purpose: "papéis semânticos anotados", required: false },
    ],
    prohibitedFields: [],
    notes: [
      "A edição grega anotada pela MACULA é o SBLGNT, a mesma já aprovada e importada em C14.",
      "A morfologia grega do produto passa a ter fonte própria por aqui; até então não existia.",
      "Não há sentido numerado por ocorrência no lado grego, ao contrário do hebraico.",
    ],
  },
  {
    id: "oshb-hebrewlexicon",
    name: "Open Scriptures HebrewLexicon (BDB + Strong)",
    language: "hbo",
    assetKind: "lexical_entry",
    homepage: "https://github.com/openscriptures/HebrewLexicon",
    repository: "https://github.com/openscriptures/HebrewLexicon",
    defaultBranch: "master",
    // HEAD de `master` em 19/11/2026, conferido pela API de refs do GitHub.
    pin: { kind: "commit", commit: "21c9add13bc727d3a951361778e97e3ff7afd1ce" },
    license: {
      declared: "CC BY 4.0 (edição digital); BDB e Strong subjacentes em domínio público",
      family: "cc-by-4.0",
      url: "https://github.com/openscriptures/HebrewLexicon",
    },
    attribution:
      "Open Scriptures HebrewLexicon, disponível em https://github.com/openscriptures/HebrewLexicon, " +
      "sob CC BY 4.0; Brown-Driver-Briggs e Strong's Hebrew Dictionary são obras históricas em " +
      "domínio público. Normalizações e seleção de campos são da Bíblia Bereana.",
    collectionStatus: "approved_for_collection",
    approval: OWNER_APPROVAL_2026_11_19,
    importable: true,
    assets: [
      // Não existe arquivo `LICENSE` neste repositório: a declaração CC BY 4.0
      // está no `readme.md`, linhas 53-55. É ele que guardamos como prova.
      { repoPath: "readme.md", localPath: "readme.md", format: "license", expectedSha256: "9a129c25674387c494571c3828aa3a8eb78459c165e275c313ae26994ce8ff22", pathConfirmed: true, readerStatus: "evidence_only" },
      { repoPath: "HebrewStrong.xml", localPath: "HebrewStrong.xml", format: "xml", expectedSha256: "a628f4f89f8bdaf2483fd3faf1abc8653cc6717758dfc9f24beb7571d9bdd0c4", pathConfirmed: true, readerStatus: "parsed" },
      { repoPath: "LexicalIndex.xml", localPath: "LexicalIndex.xml", format: "xml", expectedSha256: "8f7a605c58899d2f44430149c143c00903976e1e91232476677972a69e5bc85f", pathConfirmed: true, readerStatus: "parsed" },
      // O `BrownDriverBriggs.xml` saiu desta fonte e virou `oshb-bdb`, abaixo.
      // Não é arrumação: o BDB e o dicionário de Strong são obras distintas que
      // só dividem repositório, com autoria e granularidade diferentes, e o
      // princípio deste registro é separar ativos com atribuição própria. Em
      // fonte separada, os nomes dos elementos também ficam exatamente como
      // estão no arquivo — `def`, `sense@n`, `stem` — em vez de disputarem
      // espaço com os do HebrewStrong, que usa `meaning` e `usage`.
    ],
    selectedFields: [
      { sourceField: "entry@id", target: "entry.lexemeId", purpose: "identificador Strong do verbete", required: true },
      { sourceField: "w", target: "entry.lemma", purpose: "forma lemática hebraica", required: true },
      { sourceField: "w@xlit", target: "entry.transliteration", purpose: "transliteração publicada pela fonte", required: false },
      { sourceField: "w@pos", target: "entry.partOfSpeech", purpose: "classe gramatical do verbete", required: false },
      { sourceField: "meaning", target: "entry.definition", purpose: "definição histórica (domínio público)", required: false },
      { sourceField: "usage", target: "entry.gloss", purpose: "glossas curtas de uso", required: false },
      { sourceField: "source", target: "entry.etymology", purpose: "nota de derivação da própria fonte", required: false },
    ],
    prohibitedFields: [],
    notes: [
      "Escolhido no lugar do TBESH para definição hebraica, justamente porque não arrasta a " +
      "pendência de permissão do Abridged BDB.",
      "`LexicalIndex.xml` dá a ponte entre os lemas aumentados do MorphHB e os códigos BDB/Strong.",
    ],
  },
  {
    id: "oshb-bdb",
    name: "Brown-Driver-Briggs (edição digital Open Scriptures)",
    language: "hbo",
    assetKind: "lexical_entry",
    homepage: "https://github.com/openscriptures/HebrewLexicon",
    repository: "https://github.com/openscriptures/HebrewLexicon",
    defaultBranch: "master",
    // Mesmo repositório e mesmo commit do `oshb-hebrewlexicon`: é a mesma
    // coleta, conferida no mesmo dia. A fonte é separada por causa da obra,
    // não do download.
    pin: { kind: "commit", commit: "21c9add13bc727d3a951361778e97e3ff7afd1ce" },
    license: {
      declared: "CC BY 4.0 (edição digital); texto de Brown, Driver e Briggs em domínio público",
      family: "cc-by-4.0",
      url: "https://github.com/openscriptures/HebrewLexicon",
    },
    attribution:
      "Brown-Driver-Briggs, A Hebrew and English Lexicon of the Old Testament, obra em domínio " +
      "público; edição digital de Open Scriptures, disponível em " +
      "https://github.com/openscriptures/HebrewLexicon, sob CC BY 4.0. A hierarquia de sentidos é " +
      "preservada como publicada; a seleção de campos e a tradução editorial são da Bíblia Bereana.",
    collectionStatus: "approved_for_collection",
    approval: OWNER_APPROVAL_2026_11_19,
    importable: true,
    assets: [
      {
        repoPath: "BrownDriverBriggs.xml",
        localPath: "BrownDriverBriggs.xml",
        format: "xml",
        expectedSha256: "2b52658a4323d91674cda4090ab8b3ebddfff640f4f18143c28300e80b2c38f8",
        pathConfirmed: true,
        readerStatus: "parsed",
      },
    ],
    selectedFields: [
      { sourceField: "entry@id", target: "bdb.entryId", purpose: "identificador BDB, alvo do xref do LexicalIndex", required: true },
      { sourceField: "w", target: "bdb.lemma", purpose: "forma lemática hebraica do verbete", required: true },
      { sourceField: "pos", target: "bdb.partOfSpeech", purpose: "classe gramatical do verbete", required: false },
      { sourceField: "def", target: "bdb.definition", purpose: "definição, no verbete e em cada sentido", required: false },
      { sourceField: "sense@n", target: "bdb.senseNumber", purpose: "numeração do sentido como a obra a publica", required: false },
      { sourceField: "stem", target: "bdb.stem", purpose: "tronco verbal que agrupa sentidos (Qal, Hiphil, …)", required: false },
      { sourceField: "entry@type", target: "bdb.entryType", purpose: "marca de verbete de raiz", required: false },
    ],
    prohibitedFields: [],
    notes: [
      "11.845 verbetes e 8.989 sentidos, aninhados até cinco níveis, conferidos contra o " +
      "arquivo real. É a fonte mais rica de " +
      "acepções distintas de todo o conjunto: אָב sozinho traz nove sentidos numerados.",
      "A hierarquia é o valor da obra e não é achatada: um sentido de terceiro nível sob o tronco " +
      "Hiphil não significa o mesmo que um sentido de primeiro nível, e perder o caminho até ele " +
      "transformaria lexicografia em lista de sinônimos.",
      "O `id` do verbete (`a.ae.ab`) é exatamente o alvo de `<xref bdb=…>` em `LexicalIndex.xml`, " +
      "que já é lido: a ponte até o Strong e, por ele, até a ocorrência, já existe.",
      "`<status p=…>` registra o andamento editorial da digitalização (base, ref, made, done, " +
      "new). Não é importado: descreve o trabalho da Open Scriptures, não o verbete.",
    ],
  },
  {
    id: "stepbible-tbesg",
    name: "STEPBible TBESG — Translators Brief lexicon of Extended Strongs for Greek",
    language: "grc",
    assetKind: "lexical_entry",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    repository: "https://github.com/STEPBible/STEPBible-Data",
    defaultBranch: "master",
    // HEAD de `master` em 19/11/2026, conferido pela API de refs do GitHub.
    pin: { kind: "commit", commit: "5de0a47f35f0fc13dfe1430d104e5db8a4285f9c" },
    license: {
      declared: "CC BY 4.0",
      family: "cc-by-4.0",
      url: "https://github.com/STEPBible/STEPBible-Data",
    },
    attribution:
      "STEPBible TBESG — Tyndale House, Cambridge, STEPBible.org, sob CC BY 4.0, com indicação " +
      "das modificações feitas pela Bíblia Bereana.",
    collectionStatus: "approved_for_collection",
    approval: OWNER_APPROVAL_2026_11_19,
    importable: true,
    assets: [
      {
        repoPath: "Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt",
        localPath: "TBESG.txt",
        format: "text",
        expectedSha256: "734a5b64a1152f67604bf09d32f15c0ba537151961752fcf168087b41b4d93ea",
        pathConfirmed: true,
        readerStatus: "parsed",
      },
    ],
    selectedFields: [
      // Cabeçalho real conferido em 19/11/2026, linha 88 do arquivo. Três dos
      // seis rótulos supostos na preparação não existiam: a forma lemática é
      // `Greek` (não `Lemma`), a classe é `Morph` (não `Morphology`) e a
      // definição não tem rótulo curto — a coluna se chama literalmente pela
      // frase abaixo. É feio, mas é o nome real, e inventar um mais limpo faria
      // o leitor procurar uma coluna que o arquivo não tem.
      { sourceField: "eStrong", target: "entry.lexemeId", purpose: "Extended Strong, chave do verbete grego", required: true },
      { sourceField: "Greek", target: "entry.lemma", purpose: "forma lemática grega", required: true },
      { sourceField: "Transliteration", target: "entry.transliteration", purpose: "transliteração publicada pela fonte", required: false },
      { sourceField: "Morph", target: "entry.partOfSpeech", purpose: "classe gramatical do verbete", required: false },
      { sourceField: "Gloss", target: "entry.gloss", purpose: "glossa curta", required: true },
      {
        sourceField:
          "Abbott-Smith lexicon (AS), with gaps occationally filled from edited versions of  Middle LSJ",
        target: "entry.definition",
        purpose: "definição breve Abbott-Smith/Middle Liddell",
        required: false,
      },
    ],
    prohibitedFields: [],
    notes: [
      "O nome exato do arquivo e os rótulos das colunas mudam entre revisões do repositório; por " +
      "isso o parser é guiado pelo cabeçalho real e falha fechado quando uma coluna exigida some.",
      "As colunas `dStrong` e `uStrong` existem no arquivo e não são importadas: o produto indexa " +
      "por Extended Strong, que é o que o MACULA e o OSHB também usam.",
      "O arquivo abre com 87 linhas de prosa sem prefixo de comentário; o cabeçalho é localizado " +
      "pelas colunas exigidas, não pela posição.",
    ],
  },
  {
    id: "stepbible-tflsj",
    name: "STEPBible TFLSJ — Tyndale Full LSJ",
    language: "grc",
    assetKind: "lexical_entry",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    repository: "https://github.com/STEPBible/STEPBible-Data",
    defaultBranch: "master",
    pin: { kind: "unresolved", reason: "segunda camada; coleta não aprovada e não necessária ao MVP" },
    license: {
      declared: "CC BY 4.0",
      family: "cc-by-4.0",
      url: "https://github.com/STEPBible/STEPBible-Data",
    },
    attribution:
      "STEPBible TFLSJ — Tyndale House, Cambridge, STEPBible.org, sob CC BY 4.0; Liddell-Scott-Jones " +
      "é obra histórica em domínio público. Modificações indicadas pela Bíblia Bereana.",
    collectionStatus: "awaiting_owner_approval",
    importable: true,
    assets: [],
    selectedFields: [
      { sourceField: "eStrong", target: "entry.lexemeId", purpose: "chave do verbete grego", required: true },
      { sourceField: "Lemma", target: "entry.lemma", purpose: "forma lemática grega", required: true },
      { sourceField: "Definition", target: "entry.definition", purpose: "verbete LSJ aprofundado", required: true },
    ],
    prohibitedFields: [],
    notes: [
      "Camada opcional, para profundidade. Não entra no MVP: aumenta volume e revisão editorial " +
      "sem resolver nenhum portão aberto.",
      "Sem ativos declarados enquanto a decisão de usá-la não for tomada.",
    ],
  },
  {
    id: "stepbible-tbesh",
    name: "STEPBible TBESH — Brief lexicon of Extended Strongs for Hebrew",
    language: "hbo",
    assetKind: "lexical_entry",
    homepage: "https://github.com/STEPBible/STEPBible-Data",
    repository: "https://github.com/STEPBible/STEPBible-Data",
    defaultBranch: "master",
    pin: { kind: "unresolved", reason: "fonte restrita; não será coletada nesta frente" },
    license: {
      declared: "CC BY 4.0 no pacote, com ressalva explícita de permissão para a coluna Meaning",
      family: "permission-required",
      url: TBESH_HEADER_EVIDENCE,
    },
    attribution:
      "STEPBible TBESH — Tyndale House, Cambridge, STEPBible.org. Registrado aqui apenas para " +
      "documentar a restrição; nenhum campo é importado.",
    collectionStatus: "blocked",
    importable: false,
    assets: [],
    selectedFields: [],
    prohibitedFields: [
      {
        sourceField: "Meaning",
        reason: PROHIBITED_TBESH_MEANING_REASON,
        evidenceUrl: TBESH_HEADER_EVIDENCE,
      },
    ],
    notes: [
      "Fica no registro de propósito: uma fonte proibida que não aparece em lugar nenhum é uma " +
      "fonte que alguém vai reintroduzir sem saber por que ela saiu.",
      "Se um dia houver permissão por escrito para 'Meaning', ela entra aqui com data, titular e " +
      "texto da autorização — e só então `importable` muda.",
    ],
  },
  {
    id: "clear-bible-alignments",
    name: "Clear Bible Alignments",
    language: "multi",
    assetKind: "pipeline_reference",
    homepage: "https://github.com/Clear-Bible/Alignments",
    repository: "https://github.com/Clear-Bible/Alignments",
    defaultBranch: "main",
    pin: { kind: "unresolved", reason: "referência de formato; nada é importado" },
    license: {
      declared: "dados CC BY 4.0; código MIT",
      family: "cc-by-4.0",
      url: "https://github.com/Clear-Bible/Alignments",
    },
    attribution: "Clear Bible Alignments — usado como referência de formato, sem importação de dados.",
    collectionStatus: "awaiting_owner_approval",
    importable: false,
    assets: [],
    selectedFields: [],
    prohibitedFields: [],
    notes: [
      "Serve ao `ALIGNMENT-PIPELINE-001` como desenho de arquivo e de identificadores.",
      "Não presumir alinhamento para a BLIVRE: os alinhamentos publicados são para outras " +
      "traduções, e associar por posição é exatamente o que a tarefa proíbe.",
    ],
  },
];

export class LexiconRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LexiconRegistryError";
  }
}

export function lexiconSourceById(id: string): LexiconSource {
  const source = LEXICON_SOURCES.find((item) => item.id === id);
  if (!source) throw new LexiconRegistryError(`fonte lexical desconhecida: ${id}`);
  return source;
}

/** Fontes das quais algum campo pode virar registro nosso. */
export function importableLexiconSources(): readonly LexiconSource[] {
  return LEXICON_SOURCES.filter((source) => source.importable);
}

export function isPinned(source: LexiconSource): boolean {
  return source.pin.kind !== "unresolved";
}

export function pinLabel(pin: SourcePin): string {
  if (pin.kind === "commit") return `commit ${pin.commit}`;
  if (pin.kind === "tag") return `tag ${pin.tag} / commit ${pin.commit}`;
  return `não resolvido (${pin.reason})`;
}

/**
 * URL de download fixada pelo commit. Exige pino resolvido de propósito: uma URL
 * apontando para `main` baixa coisa diferente a cada dia e torna o SHA-256
 * inútil como pino de versão.
 */
export function assetUrl(source: LexiconSource, asset: LexiconAsset): string {
  if (source.pin.kind === "unresolved") {
    throw new LexiconRegistryError(
      `${source.id}: pino não resolvido (${source.pin.reason}); sem commit não há URL estável`,
    );
  }
  const commit = source.pin.commit;
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    throw new LexiconRegistryError(`${source.id}: commit fora do formato de 40 hex`);
  }
  const repo = source.repository.replace(/^https:\/\/github\.com\//u, "").replace(/\.git$/u, "");
  const path = asset.repoPath.split("/").map(encodeURIComponent).join("/");
  // Ativo em LFS: `raw.` devolveria o ponteiro de texto, não o arquivo.
  if (asset.lfs) {
    return `https://media.githubusercontent.com/media/${repo}/${commit}/${path}`;
  }
  return `https://raw.githubusercontent.com/${repo}/${commit}/${path}`;
}

/**
 * Reconhece o ponteiro do Git LFS pelos primeiros bytes. Serve de rede de
 * segurança: se um dia um ativo virar LFS no repositório de origem sem que o
 * registro saiba, a coleta para aqui em vez de congelar o hash de um ponteiro.
 */
export function looksLikeLfsPointer(bytes: Uint8Array): boolean {
  const head = new TextDecoder("utf8", { fatal: false }).decode(bytes.subarray(0, 120));
  return head.startsWith("version https://git-lfs.github.com/spec/v1");
}

/**
 * Recusa misturar CC BY com CC BY-SA no mesmo conjunto importado. O derivado
 * herdaria a obrigação de compartilhar pela mesma licença, o que mudaria as
 * condições de todo o léxico — decisão jurídica, não técnica.
 */
export function assertNoLicenseMixing(sources: readonly LexiconSource[]): void {
  const importable = sources.filter((source) => source.importable);
  const families = new Set(importable.map((source) => source.license.family));
  if (families.has("cc-by-sa-4.0") && families.has("cc-by-4.0")) {
    const shareAlike = importable
      .filter((source) => source.license.family === "cc-by-sa-4.0")
      .map((source) => source.id)
      .join(", ");
    throw new LexiconRegistryError(
      `mistura de licença proibida: ${shareAlike} é CC BY-SA 4.0 e contaminaria o conjunto CC BY 4.0`,
    );
  }
  const needsPermission = importable.filter((source) => source.license.family === "permission-required");
  if (needsPermission.length > 0) {
    throw new LexiconRegistryError(
      `fonte com permissão pendente marcada como importável: ${needsPermission.map((s) => s.id).join(", ")}`,
    );
  }
}

export type FieldDecision =
  | { readonly allowed: true; readonly selected: SelectedField }
  | { readonly allowed: false; readonly reason: string; readonly prohibited: boolean };

/**
 * Decide, para um campo encontrado no arquivo, se ele pode ser lido. Três
 * respostas, não duas: permitido, ignorado (não declarado) e **proibido**, que
 * é erro e não omissão.
 */
export function fieldDecision(source: LexiconSource, sourceField: string): FieldDecision {
  const prohibited = source.prohibitedFields.find((item) => item.sourceField === sourceField);
  if (prohibited) {
    return { allowed: false, prohibited: true, reason: prohibited.reason };
  }
  const selected = source.selectedFields.find((item) => item.sourceField === sourceField);
  if (selected) return { allowed: true, selected };
  return {
    allowed: false,
    prohibited: false,
    reason: `campo '${sourceField}' não está em selectedFields de ${source.id}; ignorado`,
  };
}

export function assertFieldAllowed(source: LexiconSource, sourceField: string): SelectedField {
  const decision = fieldDecision(source, sourceField);
  if (decision.allowed) return decision.selected;
  throw new LexiconRegistryError(
    decision.prohibited
      ? `campo proibido em ${source.id}: '${sourceField}'. ${decision.reason}`
      : decision.reason,
  );
}

/**
 * Serialização determinística do registro, para gerar impressão digital estável
 * (hash calculado fora daqui, onde `node:crypto` existe). Mudou o registro,
 * muda a impressão digital, e todo artefato derivado precisa ser regerado.
 */
export function serializeRegistry(sources: readonly LexiconSource[] = LEXICON_SOURCES): string {
  const ordered = [...sources].sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify(
    {
      version: LEXICON_REGISTRY_VERSION,
      sources: ordered.map((source) => ({
        id: source.id,
        language: source.language,
        assetKind: source.assetKind,
        repository: source.repository,
        pin: source.pin,
        license: source.license,
        attribution: source.attribution,
        collectionStatus: source.collectionStatus,
        importable: source.importable,
        assets: [...source.assets]
          .sort((left, right) => left.repoPath.localeCompare(right.repoPath))
          .map((asset) => ({
            repoPath: asset.repoPath,
            localPath: asset.localPath,
            format: asset.format,
            expectedSha256: asset.expectedSha256,
          })),
        selectedFields: [...source.selectedFields]
          .sort((left, right) => left.sourceField.localeCompare(right.sourceField))
          .map((field) => ({ sourceField: field.sourceField, target: field.target, required: field.required })),
        prohibitedFields: [...source.prohibitedFields]
          .sort((left, right) => left.sourceField.localeCompare(right.sourceField))
          .map((field) => ({ sourceField: field.sourceField, reason: field.reason })),
      })),
    },
    null,
    0,
  );
}
