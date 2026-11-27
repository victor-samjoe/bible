/**
 * Serviço de consulta de usos por palavra (fila Claude 3, item 3).
 *
 * Injetável por desenho: recebe portas, não implementações. Não importa
 * `node:*`, não abre conexão e não conhece caminho de arquivo — de modo que o
 * contrato inteiro é testável com portas de memória, e o mesmo serviço roda no
 * Worker ou em script.
 *
 * Três invariantes que este arquivo garante:
 *
 * 1. **Nenhum caminho privado sai no resultado.** O manifesto conhece nomes de
 *    arquivo; o resultado não os carrega. O que o cliente recebe é identidade,
 *    referências, cobertura, procedência da fonte e versão — nunca onde o
 *    arquivo está. Ver `QueryProvenance`.
 * 2. **Falha não vira vazio.** Partição ilegível, JSON quebrado ou hash
 *    divergente devolvem `error` com motivo. Devolver lista vazia nesse caso
 *    diria ao leitor que a palavra não ocorre, o que é mentira sobre o texto.
 * 3. **Degradação por camada.** Índice indisponível não derruba a consulta com
 *    exceção: devolve `no_index`, e o leitor segue mostrando o original.
 */

import {
  type IndexHeader,
  type PartitionStat,
  type Posting,
  decodeOccurrences,
  partitionForIdentity,
} from "../../domain/word-study/inverted-index.ts";
import {
  type UsesQueryInput,
  type WordUsesResult,
  isExhaustive,
  layersForIndexOnly,
  pageOfPosting,
  planQuery,
  warningsFor,
  WORD_STUDY_QUERY_CONTRACT,
} from "../../domain/word-study/query.ts";
import { type VersificationMap } from "../../domain/word-study/versification.ts";

/** O manifesto, como o gerador o grava. `null` = nenhum índice publicado. */
export type IndexManifest = {
  readonly header: IndexHeader;
  readonly partitions: readonly PartitionStat[];
};

export type ManifestPort = {
  /** `null` quando não há índice. Lançar significa falha de leitura, não ausência. */
  read(): Promise<IndexManifest | null>;
};

export type PartitionPort = {
  /**
   * Conteúdo da partição. O `file` vem **sempre** do manifesto; a porta deve
   * recusar qualquer outro nome, e é ela quem impede travessia de caminho.
   */
  read(file: string): Promise<string>;
};

/** Hash injetado para que o serviço continue sem `node:crypto`. */
export type DigestPort = (body: string) => string;

export type WordStudyServiceOptions = {
  readonly manifest: ManifestPort;
  readonly partitions: PartitionPort;
  readonly versification: VersificationMap;
  /**
   * Quando presente, a integridade da partição é conferida contra o SHA-256 do
   * manifesto. Ausente, a conferência é anunciada como não feita — e não
   * silenciosamente pulada: `integrityChecked` entra nos avisos.
   */
  readonly digest?: DigestPort | null;
};

export type WordStudyService = {
  findUses(input: UsesQueryInput): Promise<WordUsesResult>;
};

export function createWordStudyService(options: WordStudyServiceOptions): WordStudyService {
  const { manifest: manifestPort, partitions: partitionPort, versification } = options;
  const digest = options.digest ?? null;

  return {
    async findUses(input) {
      const planned = planQuery(input);
      if (!("plan" in planned)) {
        return { status: "invalid_query", reason: planned.reason };
      }
      const { plan } = planned;

      let manifest: IndexManifest | null;
      try {
        manifest = await manifestPort.read();
      } catch (error) {
        return { status: "error", reason: `falha ao ler o manifesto: ${describe(error)}` };
      }
      if (manifest === null) {
        return { status: "no_index", reason: "nenhum índice de usos publicado" };
      }
      if (plan.cursorIndexVersion !== null && plan.cursorIndexVersion !== manifest.header.indexVersion) {
        return { status: "invalid_query", reason: "cursor pertence a outra versão do índice; reinicie a consulta" };
      }
      if (manifest.partitions.length === 0) {
        // Manifesto sem partição é índice vazio, não índice ausente: alguém
        // gerou o índice e nada entrou nele. Os dois pedem ação diferente.
        return {
          status: "empty",
          identityKey: plan.identity.key,
          exhaustive: false,
          coverage: manifest.header.coverage,
          provenance: provenanceOf(manifest, versification),
          layers: layersForIndexOnly(manifest.header.indexVersion),
          warnings: [
            "O índice existe e não tem nenhuma partição: nada foi indexado.",
            ...manifest.header.limitations,
          ],
        };
      }

      const partition = partitionForIdentity(manifest.partitions, plan.identity);
      if (partition === null) {
        // Fora de todo intervalo de chave: a palavra não está no índice.
        return emptyResult(manifest, versification, plan.identity.key);
      }

      let body: string;
      try {
        body = await partitionPort.read(partition.file);
      } catch (error) {
        return {
          status: "error",
          reason: `falha ao ler a partição ${partition.ordinal}: ${describe(error)}`,
        };
      }

      if (digest) {
        const actual = digest(body);
        if (actual !== partition.sha256) {
          // Falha fechada. Conteúdo que não confere com o manifesto pode ser
          // de outra versão do índice, e servir referência de versão
          // desconhecida é pior que não servir nada.
          return {
            status: "error",
            reason:
              `integridade da partição ${partition.ordinal} não confere: ` +
              `manifesto ${partition.sha256.slice(0, 12)}…, arquivo ${actual.slice(0, 12)}…`,
          };
        }
      }

      let posting: Posting | null;
      try {
        posting = findPosting(body, plan.identity);
      } catch (error) {
        return {
          status: "error",
          reason: `partição ${partition.ordinal} ilegível: ${describe(error)}`,
        };
      }
      if (posting === null) {
        // A partição era a certa pelo intervalo, mas a chave não está nela.
        return emptyResult(manifest, versification, plan.identity.key);
      }

      const page = pageOfPosting(posting, plan, versification, manifest.header.indexVersion);
      const warnings = [
        ...warningsFor(
          page.groups,
          manifest.header.coverage,
          versification,
          manifest.header.limitations,
        ),
      ];
      if (!digest) {
        warnings.push(
          "Integridade da partição não foi conferida: nenhuma função de hash foi fornecida ao serviço.",
        );
      }

      const exhaustive = isExhaustive(manifest.header.coverage);
      const common = {
        identityKey: plan.identity.key,
        page,
        coverage: manifest.header.coverage,
        provenance: provenanceOf(manifest, versification),
        layers: layersForIndexOnly(manifest.header.indexVersion),
        warnings,
      };
      return exhaustive ? { status: "complete", ...common } : { status: "partial", ...common };
    },
  };
}

function emptyResult(
  manifest: IndexManifest,
  versification: VersificationMap,
  identityKey: string,
): WordUsesResult {
  const exhaustive = isExhaustive(manifest.header.coverage);
  return {
    status: "empty",
    identityKey,
    exhaustive,
    coverage: manifest.header.coverage,
    provenance: provenanceOf(manifest, versification),
    layers: layersForIndexOnly(manifest.header.indexVersion),
    warnings: exhaustive
      ? [...manifest.header.limitations]
      : [
          // O aviso que impede a tela de dizer "esta palavra não ocorre".
          "Vazio não exaustivo: não há registros para esta chave no índice disponível. " +
            "Isso não comprova ausência na Bíblia nem de outras formas do lema.",
          ...manifest.header.limitations,
        ],
  };
}

function provenanceOf(manifest: IndexManifest, versification: VersificationMap) {
  return {
    indexVersion: manifest.header.indexVersion,
    identityMode: manifest.header.identityMode,
    versificationVersion: versification.version,
    contract: WORD_STUDY_QUERY_CONTRACT,
    // Atribuição vem do cabeçalho, que é o que a importação registrou. Nenhum
    // caminho de arquivo é copiado para cá.
    sources: manifest.header.sources.map((source) => ({
      sourceId: source.sourceId,
      assetPath: source.assetPath,
      assetSha256: source.assetSha256,
      pin: source.pin,
      licenseDeclared: source.licenseDeclared,
      attribution: source.attribution,
    })),
  } as const;
}

/**
 * Procura a postagem na partição. Lê linha a linha e para na chave; não monta
 * um mapa da partição inteira, porque a partição existe justamente para que uma
 * consulta não precise materializar o índice.
 */
function findPosting(body: string, identity: { readonly key: string }): Posting | null {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    // Filtro textual antes de desserializar: evita `JSON.parse` em cada linha
    // da partição para achar uma chave.
    if (!trimmed.includes(`"k":${JSON.stringify(identity.key)}`)) continue;
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("linha de postagem não é objeto");
    }
    const record = parsed as { k?: unknown; n?: unknown; r?: unknown };
    if (record.k !== identity.key) continue;
    if (!Array.isArray(record.r)) throw new Error("postagem sem vetor de ocorrências");
    const encoded = record.r.filter((item): item is number => typeof item === "number");
    if (encoded.length !== record.r.length) {
      throw new Error("vetor de ocorrências com valor não numérico");
    }
    const occurrences = decodeOccurrences(encoded);
    if (occurrences === null) throw new Error("vetor de ocorrências inválido");
    if (typeof record.n === "number" && record.n !== occurrences.length) {
      // `n` é redundante com `r` de propósito: discordarem denuncia arquivo
      // corrompido ou truncado que ainda assim é JSON válido.
      throw new Error(`contagem declarada ${record.n} difere de ${occurrences.length} decodificada(s)`);
    }
    return { identity: identity as Posting["identity"], occurrences };
  }
  return null;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
