"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildReadingNotes, type ReadingNote } from "@/src/domain/notes-library";
import { READER_SESSION_KEY } from "@/src/domain/reading-session";
import styles from "./page.module.css";

type StoredReaderState = { readonly notes?: Record<string, string> };

function readSessionNotes(): Record<string, string> {
  const raw = window.sessionStorage.getItem(READER_SESSION_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const notes = (parsed as StoredReaderState).notes;
    return notes && typeof notes === "object" ? notes : {};
  } catch {
    return {};
  }
}

export function NotesLibrary({
  accountNotes,
  bookNames,
  signedIn,
}: {
  readonly accountNotes: Readonly<Record<string, string>>;
  readonly bookNames: Readonly<Record<string, string>>;
  readonly signedIn: boolean;
}) {
  const [notes, setNotes] = useState<readonly ReadingNote[]>(() => buildReadingNotes(accountNotes, bookNames));
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    try {
      // A conta vence uma chave repetida, igual ao leitor. A sessão apenas
      // completa o que ainda não subiu ou pertence a quem lê sem entrar.
      const merged = { ...readSessionNotes(), ...accountNotes };
      setNotes(buildReadingNotes(merged, bookNames));
    } catch {
      setStorageAvailable(false);
      setNotes(buildReadingNotes(accountNotes, bookNames));
    }
  }, [accountNotes, bookNames]);

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>LEITURA</p>
        <h1>Notas.</h1>
        <p>{signedIn ? "Suas anotações de leitura." : "Anotações desta sessão neste navegador."}</p>
      </header>

      {notes.length > 0 ? (
        <section className={styles.list} aria-label="Suas notas">
          {notes.map((note) => (
            <article className={styles.note} key={note.key}>
              <Link href={note.path} className={styles.reference}>{note.reference}</Link>
              <p>{note.text}</p>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.empty} aria-label="Nenhuma nota ainda">
          <p>Nenhuma nota ainda.</p>
          <Link href="/biblia">Abrir a Bíblia</Link>
        </section>
      )}

      {!signedIn ? (
        <p className={styles.hint}>
          {storageAvailable
            ? "Entre para manter suas notas na conta."
            : "O armazenamento deste navegador está indisponível agora."}
          {storageAvailable ? <Link href="/entrar"> Entrar</Link> : null}
        </p>
      ) : null}
    </main>
  );
}
