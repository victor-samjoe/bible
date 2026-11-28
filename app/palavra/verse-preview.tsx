"use client";

import { useEffect, useState } from "react";
import { CANON } from "@/src/domain/lexicon/canon";
import type { VerseUses } from "@/src/domain/word-study/query";
import { knownWordHighlights } from "@/src/domain/lexicon/verse-highlight";
import styles from "./palavra.module.css";

type Manifest = { version: string; files: { book: string; path: string; sha256: string }[] };
type Book = { version: string; book: string; chapters: unknown[] };
let manifestPromise: Promise<Manifest> | null = null;
const books = new Map<string, Promise<Book>>();

function manifest(): Promise<Manifest> {
  if (!manifestPromise) manifestPromise = fetch("/biblia-offline/manifest.json").then(async (res) => {
    if (!res.ok) throw new Error("manifesto indisponível");
    const data: unknown = await res.json();
    if (typeof data !== "object" || data === null || typeof (data as Manifest).version !== "string" || !Array.isArray((data as Manifest).files)) throw new Error("manifesto inválido");
    return data as Manifest;
  }).catch((error) => { manifestPromise = null; throw error; });
  return manifestPromise;
}

async function bookFor(code: string): Promise<Book> {
  const index = await manifest();
  const file = index.files.find((entry) => entry.book === code);
  if (!file || !/^[a-f0-9]{64}$/u.test(index.version) || file.path !== `/biblia-offline/${index.version}/${code}.json` || !/^[a-f0-9]{64}$/u.test(file.sha256)) throw new Error("livro indisponível");
  const cacheKey = `${index.version}:${code}`;
  let pending = books.get(cacheKey);
  if (!pending) {
    pending = fetch(file.path).then(async (response) => {
      if (!response.ok) throw new Error("livro indisponível");
      const bytes = await response.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", bytes);
      if ([...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("") !== file.sha256) throw new Error("integridade inválida");
      const book: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (typeof book !== "object" || book === null || (book as Book).book !== code || (book as Book).version !== index.version || !Array.isArray((book as Book).chapters)) throw new Error("livro inválido");
      return book as Book;
    }).catch((error) => { books.delete(cacheKey); throw error; });
    books.set(cacheKey, pending);
  }
  return pending;
}

/** Mesma limpeza USFM usada pela leitura, preservando o texto acrescentado. */
function plainVerse(value: string): string {
  return value.replace(/\\(?:f|x)\b[\s\S]*?\\(?:f|x)\*/g, " ").replace(/\\add\*?/g, "").replace(/\\[a-z0-9]+\*?(?:\s+)?/gi, "").replace(/\s+/g, " ").trim();
}

export function VersePreview({ group, strong }: { readonly group: VerseUses; readonly strong?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const source = /^(\w{3}) (\d+):(\d+)$/u.exec(group.sourceRef);
  const target = /^(\w{3}) (\d+):(\d+)$/u.exec(group.readerRef);
  const book = CANON.find((entry) => entry.code === source?.[1]);
  const label = book && source ? `${book.name} ${source[2]}:${source[3]}` : group.sourceRef;
  useEffect(() => {
    const currentTarget = /^(\w{3}) (\d+):(\d+)$/u.exec(group.readerRef);
    if (!open || !currentTarget || !book) return;
    let live = true;
    setError(false);
    bookFor(currentTarget[1]!).then((data) => {
      const chapter = data.chapters[Number(currentTarget[2]) - 1];
      const verse = Array.isArray(chapter) ? chapter[Number(currentTarget[3]) - 1] : null;
      if (typeof verse !== "string" || !plainVerse(verse)) throw new Error("versículo indisponível");
      if (live) setText(plainVerse(verse));
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  // Referências são imutáveis para cada componente; não usar arrays produzidos pelo regex como dependência.
  }, [open, group.readerRef, book]);
  if (!source || !target || !book) return <b>{group.sourceRef}</b>;
  const highlights = text && target[1] === "GEN" && target[2] === "1" && strong
    ? knownWordHighlights(Number(target[3]), strong, text, group.occurrences) : [];
  return <div className={styles.previewItem} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <button className={styles.previewTrigger} type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{label}</button>
    {group.occurrences > 1 ? ` · ${group.occurrences} ocorrências` : null}
    {open ? <div className={styles.previewBox} role="region" aria-label={`Prévia de ${label}`}>
      <small>Bíblia Livre{group.versification === "mapped" ? ` · ${book.name} ${target[2]}:${target[3]}` : ""}</small>
      {error ? <p role="status">Não foi possível carregar este versículo.</p> : <p>{text && highlights.length ? <>
        {highlights.map((part, index) => <span key={part.start}>{text.slice(index ? highlights[index - 1]!.end : 0, part.start)}<strong>{text.slice(part.start, part.end)}</strong></span>)}
        {text.slice(highlights[highlights.length - 1]!.end)}
      </> : text ?? "Carregando…"}</p>}
      {group.versification === "unverified" ? <small>A numeração pode divergir da edição original; confira a referência.</small> : null}
    </div> : null}
  </div>;
}
