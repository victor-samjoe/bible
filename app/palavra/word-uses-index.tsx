"use client";

import { useRef, useState } from "react";
import { parseWordStudyManifest } from "@/src/domain/word-study/manifest";
import { WORD_STUDY_VERSIFICATION } from "@/src/domain/word-study/versification";
import { createWordStudyService, type WordStudyService } from "@/src/server/word-study/service";
import type { VerseUses } from "@/src/domain/word-study/query";
import styles from "./palavra.module.css";
import { VersePreview } from "./verse-preview";

// O caminho contém a versão do conteúdo: um manifesto novo não pode apontar
// acidentalmente para uma partição antiga ainda guardada no cache da CDN.
const INDEX_ROOT = "/word-study/cf56d8fd29bb1ed5";

async function makeService(): Promise<WordStudyService> {
  const response = await fetch(`${INDEX_ROOT}/manifest.json`);
  if (!response.ok) throw new Error("Índice indisponível no momento.");
  const manifest = parseWordStudyManifest(await response.json());
  if (manifest.header.indexVersion !== "cf56d8fd29bb1ed5") throw new Error("Versão do índice incompatível.");
  const files = new Map(manifest.partitions.map((part) => [part.file, part.sha256]));
  const cache = new Map<string, string>();
  const digest = async (body: string) => {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  return createWordStudyService({
    manifest: { read: async () => manifest },
    partitions: { read: async (file) => {
      if (!files.has(file)) throw new Error("Partição não declarada.");
      const saved = cache.get(file);
      if (saved !== undefined) return saved;
      const result = await fetch(`${INDEX_ROOT}/${encodeURIComponent(file)}`);
      if (!result.ok) throw new Error("Partição indisponível.");
      const body = await result.text();
      if (await digest(body) !== files.get(file)) throw new Error("Integridade da partição não confere.");
      cache.set(file, body);
      return body;
    } },
    digest,
    versification: WORD_STUDY_VERSIFICATION,
  });
}

export function WordUsesIndex({ language, strong }: { readonly language: string; readonly strong: string }) {
  const service = useRef<WordStudyService | null>(null);
  const [groups, setGroups] = useState<readonly VerseUses[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  async function load(more: boolean) {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const client = service.current ?? await makeService();
      service.current = client;
      const result = await client.findUses({ language, strong, cursor: more ? cursor : null, limit: 25 });
      if (result.status === "partial" || result.status === "complete") {
        setGroups((existing) => more ? [...existing, ...result.page.groups] : result.page.groups);
        setCursor(result.page.nextCursor); setTotal(result.page.totalOccurrences); setStarted(true);
      } else if (result.status === "empty") {
        setGroups([]); setCursor(null); setTotal(0); setStarted(true);
      } else throw new Error("Não foi possível consultar o índice agora.");
    } catch { setError("Não foi possível consultar as ocorrências. Tente novamente."); }
    finally { setLoading(false); }
  }
  return <div className={styles.indexSearch}>
    <button className={styles.listen} type="button" disabled={loading} onClick={() => load(started && cursor !== null)}>
      {loading ? "Consultando…" : !started ? "Buscar ocorrências em outros livros" : cursor ? "Ver mais ocorrências" : "Buscar novamente"}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    {started ? <>
      <p>Ocorrências da fonte para este código Strong: {total}. A cobertura não foi certificada e outras formas da palavra podem usar códigos diferentes.</p>
      {groups.length ? <ol className={styles.indexResults}>{groups.map((group) => <li key={group.sourceRefCode}>
        <VersePreview group={group} strong={strong} />
      </li>)}</ol> : <p>Nenhuma ocorrência para este código no índice disponível.</p>}
      <details className={styles.source}><summary>Fontes das ocorrências</summary>
        <p><a href="https://github.com/Clear-Bible/macula-hebrew">MACULA Hebrew</a> e <a href="https://github.com/Clear-Bible/macula-greek">MACULA Greek</a>, Clear Bible, Inc., <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. A Bíblia Bereana selecionou e organizou as referências e posições em um índice; as referências seguem a numeração das fontes.</p>
      </details>
    </> : null}
  </div>;
}
