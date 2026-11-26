import {
  OFFLINE_FILE_BYTES_LIMIT,
  OFFLINE_MANIFEST_PATH,
  type OfflineFileEntry,
} from "../../domain/offline/package";
import type { BookFetch, Digest, ManifestFetch, OfflineSource } from "./install";

/**
 * Adaptadores de navegador: rede, hash e exclusão mútua entre abas.
 *
 * Tudo que depende de `window`, `fetch`, `crypto.subtle` ou `navigator.locks`
 * mora aqui, e nada mais. A lógica de instalação em `./install.ts` não importa
 * este arquivo — recebe estas funções por injeção, por isso roda em teste sem
 * navegador.
 */

/**
 * SHA-256 em hexadecimal, pela Web Crypto.
 *
 * Exige contexto seguro: existe em HTTPS e em `localhost`, não em HTTP comum.
 * Se não existir, a instalação não acontece — e isso é o comportamento certo:
 * sem poder conferir o hash, não há como distinguir o pacote de uma resposta
 * trocada, e gravar texto bíblico não verificado é pior do que não ter offline.
 */
export const sha256Hex: Digest = async (text) => {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto indisponível: pacote offline exige contexto seguro (HTTPS)");
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export function createOfflineSource(fetcher: typeof fetch = fetch): OfflineSource {
  return {
    async fetchManifest(etag): Promise<ManifestFetch> {
      try {
        // `cache: "no-cache"`, não `"no-store"`, e a diferença foi medida:
        //
        //   no-store + If-None-Match → 200, 8.519 bytes transferidos
        //   no-cache + If-None-Match → 304,   300 bytes transferidos
        //
        // Com `no-store` o Chrome não toca no cache e **descarta** a
        // condicional que escrevemos, então toda verificação rebaixava o
        // manifesto inteiro. Com `no-cache` ele revalida de verdade: a
        // condicional vai, o 304 volta, e o JS vê o 304 — que é o que permite
        // dizer "não mudou" sem reinterpretar o corpo. Uma versão nova
        // continua chegando na hora, porque `no-cache` revalida sempre.
        const response = await fetcher(OFFLINE_MANIFEST_PATH, {
          cache: "no-cache",
          headers: etag ? { "If-None-Match": etag } : undefined,
        });
        if (response.status === 304) return { status: "unchanged", etag };
        if (!response.ok) return { status: "unreachable" };
        const text = await response.text();
        return {
          status: "fresh",
          parsed: JSON.parse(text) as unknown,
          etag: response.headers.get("ETag"),
        };
      } catch {
        return { status: "unreachable" };
      }
    },

    async fetchBook(entry: OfflineFileEntry): Promise<BookFetch> {
      try {
        const response = await fetcher(entry.path);
        if (!response.ok) return { status: "unreachable" };

        // O corpo é lido como bytes para medir o tamanho real antes de virar
        // texto: `Content-Length` pode faltar ou mentir, e um teto medido no
        // que chegou é o que protege contra resposta enorme no lugar do arquivo.
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > OFFLINE_FILE_BYTES_LIMIT) return { status: "unreachable" };
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        return { status: "fetched", text, bytes: buffer.byteLength };
      } catch {
        return { status: "unreachable" };
      }
    },
  };
}

/**
 * Deduplica verificações simultâneas dentro da mesma aba.
 *
 * Abrir a Bíblia dispara a verificação; abrir três capítulos em sequência
 * dispararia três. Enquanto uma estiver em voo, as outras recebem a mesma
 * promessa em vez de abrir outra requisição.
 */
export function dedupe<T>(run: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (inFlight) return inFlight;
    inFlight = run().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };
}
