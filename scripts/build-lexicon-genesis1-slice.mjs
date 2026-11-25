// Recorte limitado e reproduzível de Gênesis 1, sem modificar o índice de origem.
//
// O recorte **não** confia em `--scope` do importador: ele materializa em
// arquivo só o que é alcançável a partir das ocorrências de `GEN 1` — verbetes
// pela chave de lema, verbetes do BDB pela ponte, traduções pelo sujeito — e
// então **valida o próprio resultado** antes de considerá-lo pronto. `--scope`
// sozinho filtra referências e não limita verbete nem ponte do BDB.
//
// Falha fechada. Qualquer uma destas condições aborta sem escrever nada:
//
// - nenhuma ocorrência de `GEN 1`;
// - ocorrência fora do recorte no arquivo de saída;
// - chave de lema sem verbete **que não seja** Strong aumentado (ver abaixo);
// - ponte do BDB apontando para verbete ausente, ou partindo de lema que não
//   ocorre no recorte;
// - tradução cujo sujeito não é alcançável pelo recorte;
// - linha malformada em qualquer entrada, com o número da linha no erro.
//
// Sobre Strong aumentado: o MACULA usa chaves como `hbo:H871a`, e o léxico de
// verbete indexa por `H871`. Dezesseis das 109 chaves de Gênesis 1 são assim e
// legitimamente não têm verbete; cair para a forma sem sufixo colaria o verbete
// de **outra** palavra. Por isso a validação distingue os dois casos em vez de
// exigir verbete para toda chave.
import fs from "node:fs";
import readline from "node:readline";
import path from "node:path";
import crypto from "node:crypto";

/** Único lugar onde o alvo do recorte é definido. */
export const SCOPE = { bookCode: "GEN", chapter: 1 };

/** `GEN 1:12` está no recorte; `GEN 12:1` e `GEN 1:1a` não. */
export function inScope(canonicalRef) {
  if (typeof canonicalRef !== "string") return false;
  const match = /^([A-Z0-9]{3}) (\d+):(\d+)$/u.exec(canonicalRef);
  if (!match) return false;
  return match[1] === SCOPE.bookCode && Number(match[2]) === SCOPE.chapter;
}

/** Chave de Strong aumentado: sufixo de uma letra, como `hbo:H871a`. */
export function isAugmentedStrongKey(lexemeKey) {
  return /^(hbo|grc):[HG]\d+[a-z]$/u.test(lexemeKey ?? "");
}

/**
 * Formato do sujeito de glossa. **Duplica** `glossSubjectKey()` de
 * `src/domain/lexicon/translation-store.ts` porque este arquivo é `.mjs` e não
 * importa módulo TypeScript sem o flag de strip-types. A duplicação é fixada
 * por teste: `tests/scripts/lexicon-genesis1-slice.test.ts` compara as duas
 * implementações e falha se divergirem.
 */
export function glossSubject(language, glossText) {
  return `gloss:${language}:${String(glossText).trim().normalize("NFC")}`;
}

/** Lê NDJSON relatando o número da linha quando o JSON é inválido. */
export async function* ndjson(filePath) {
  const reader = readline.createInterface({
    input: fs.createReadStream(filePath, "utf8"),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  let lineNumber = 0;
  for await (const line of reader) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      yield [JSON.parse(line), line, lineNumber];
    } catch (error) {
      throw new Error(`${filePath}: linha ${lineNumber} não é JSON válido (${error.message})`);
    }
  }
}

/**
 * Decide o que entra no recorte. Separado do laço de escrita para que o teste
 * exercite a regra com entradas pequenas, sem arquivo de 564 MB.
 */
export function selectionFor({ lexemeKeys, bdbIds }) {
  return (record) => {
    switch (record.type) {
      case "occurrence":
        return inScope(record.canonicalRef);
      case "entry":
        return lexemeKeys.has(record.key);
      case "bdb":
        return bdbIds.has(record.bdbId);
      case "bdb_link":
        return lexemeKeys.has(record.lexemeKey) && bdbIds.has(record.bdbId);
      default:
        return false;
    }
  };
}

/**
 * Valida o recorte já montado. Devolve a lista de problemas; vazia significa
 * aprovado. Separada da escrita para ser testável e para que o programa possa
 * abortar **antes** de publicar o arquivo.
 */
export function validateSlice({ occurrences, lexemeKeys, entryKeys, bdbIds, linkPairs, subjects, translationSubjects }) {
  const problems = [];

  if (occurrences === 0) {
    problems.push(`nenhuma ocorrência de ${SCOPE.bookCode} ${SCOPE.chapter} encontrada`);
  }

  const semVerbete = [...lexemeKeys].filter((key) => !entryKeys.has(key) && !isAugmentedStrongKey(key));
  if (semVerbete.length > 0) {
    problems.push(
      `${semVerbete.length} chave(s) de lema sem verbete e sem Strong aumentado: ${semVerbete.slice(0, 5).join(", ")}`,
    );
  }

  for (const [lexemeKey, bdbId] of linkPairs) {
    if (!bdbIds.has(bdbId)) problems.push(`ponte ${lexemeKey} → ${bdbId}: verbete do BDB ausente do recorte`);
    if (!lexemeKeys.has(lexemeKey)) problems.push(`ponte ${lexemeKey} → ${bdbId}: lema não ocorre em ${SCOPE.bookCode} ${SCOPE.chapter}`);
  }

  for (const subject of translationSubjects) {
    // Tradução cujo sujeito não é alcançável carregaria para o banco texto que
    // nenhuma palavra do recorte exibe.
    if (!subjects.has(subject) && !lexemeKeys.has(subject)) {
      problems.push(`tradução de sujeito inalcançável: ${subject}`);
    }
  }

  return problems;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function main() {
  const root = path.join(import.meta.dirname, "..", "data", "generated", "lexicons");
  const source = path.join(root, "lexicon-index.ndjson");
  const translations = path.join(root, "translations.ndjson");
  const output = path.join(root, "genesis1-index.ndjson");
  const outputTranslations = path.join(root, "genesis1-translations.ndjson");

  for (const required of [source, translations]) {
    if (!fs.existsSync(required)) throw new Error(`entrada ausente: ${required}`);
  }

  // Passo 1: o que Gênesis 1 alcança.
  const lexemeKeys = new Set();
  const subjects = new Set();
  const entryKeys = new Set();
  let occurrences = 0;
  let semPosicao = 0;
  for await (const [record] of ndjson(source)) {
    if (record.type === "entry") entryKeys.add(record.key);
    if (record.type !== "occurrence" || !inScope(record.canonicalRef)) continue;
    lexemeKeys.add(record.lexemeKey);
    if (record.gloss) subjects.add(glossSubject(record.language, record.gloss));
    if (record.wordPosition === null) semPosicao += 1;
    occurrences += 1;
  }

  // Passo 2: verbetes do BDB alcançados pelas pontes dessas chaves.
  const bdbIds = new Set();
  const linkPairs = [];
  for await (const [record] of ndjson(source)) {
    if (record.type === "bdb_link" && lexemeKeys.has(record.lexemeKey)) {
      bdbIds.add(record.bdbId);
      linkPairs.push([record.lexemeKey, record.bdbId]);
    }
  }

  // Passo 3: traduções alcançáveis, em streaming — o arquivo cresce com a
  // tradução do corpus e lê-lo inteiro em memória não escala.
  const translationLines = [];
  const translationSubjects = [];
  for await (const [record, line] of ndjson(translations)) {
    const subject = record.lexemeKey;
    if (subjects.has(subject) || lexemeKeys.has(subject)) {
      translationLines.push(line);
      translationSubjects.push(subject);
    }
  }

  // Passo 4: validar **antes** de escrever.
  const problems = validateSlice({
    occurrences,
    lexemeKeys,
    entryKeys,
    bdbIds,
    linkPairs,
    subjects,
    translationSubjects,
  });
  if (problems.length > 0) {
    throw new Error(`recorte reprovado (${problems.length}):\n  - ${problems.slice(0, 10).join("\n  - ")}`);
  }

  // Passo 5: escrever, contando o que saiu.
  const include = selectionFor({ lexemeKeys, bdbIds });
  const counts = {};
  const writer = fs.createWriteStream(output, { encoding: "utf8" });
  for await (const [record, line] of ndjson(source)) {
    if (!include(record)) continue;
    if (!writer.write(line + "\n")) await new Promise((resolve) => writer.once("drain", resolve));
    counts[record.type] = (counts[record.type] || 0) + 1;
  }
  await new Promise((resolve, reject) => {
    writer.on("error", reject);
    writer.end(resolve);
  });
  fs.writeFileSync(
    outputTranslations,
    translationLines.join("\n") + (translationLines.length ? "\n" : ""),
    "utf8",
  );

  // Passo 6: pós-condição no arquivo escrito, não nas variáveis em memória.
  const escritas = { occurrence: 0, entry: 0, bdb: 0, bdb_link: 0 };
  for await (const [record] of ndjson(output)) {
    if (record.type === "occurrence" && !inScope(record.canonicalRef)) {
      throw new Error(`pós-condição falhou: ${record.canonicalRef} fora do recorte no arquivo escrito`);
    }
    if (record.type in escritas) escritas[record.type] += 1;
  }
  if (escritas.occurrence !== occurrences) {
    throw new Error(`pós-condição falhou: ${occurrences} ocorrência(s) contadas e ${escritas.occurrence} escritas`);
  }

  console.log(
    JSON.stringify({
      occurrences,
      lexemes: lexemeKeys.size,
      bdbIds: bdbIds.size,
      counts,
      translations: translationLines.length,
      indexBytes: fs.statSync(output).size,
      translationBytes: fs.statSync(outputTranslations).size,
      // Os digests tornam a reprodutibilidade conferível sem diff manual.
      indexSha256: sha256(output),
      translationSha256: sha256(outputTranslations),
      // Notas, não problemas: chave aumentada sem verbete é esperada.
      notas: {
        chavesSemVerbete: [...lexemeKeys].filter((key) => !entryKeys.has(key)).length,
        ocorrenciasSemPosicao: semPosicao,
      },
    }),
  );
}

// Só executa como programa; o módulo é importado pelos testes.
if (process.argv[1]?.replace(/\\/gu, "/").endsWith("build-lexicon-genesis1-slice.mjs")) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
