"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  READER_SESSION_KEY,
  READING_POINTER_KEY,
  emptySnapshot,
  parseLocalReadingSnapshot,
  type LocalReadingSnapshot,
} from "@/src/domain/reading-session";
import styles from "./dashboard.module.css";

// Painel pessoal (tarefa C15). Tudo que aparece como número vem do registro
// local desta sessão do navegador, lido depois da hidratação. Não há banco,
// conta, sincronização ou estimativa: sem registro, cada bloco diz que está
// vazio e mostra o caminho para começar a ler.

type LoadState = "lendo" | "pronto" | "sem-armazenamento";

export function PersonalDashboard() {
  const [snapshot, setSnapshot] = useState<LocalReadingSnapshot>(emptySnapshot);
  const [state, setState] = useState<LoadState>("lendo");

  useEffect(() => {
    try {
      setSnapshot(
        parseLocalReadingSnapshot({
          session: window.sessionStorage.getItem(READER_SESSION_KEY),
          pointer: window.sessionStorage.getItem(READING_POINTER_KEY),
        }),
      );
      setState("pronto");
    } catch {
      // Navegador sem sessionStorage (ou bloqueado): o painel diz isso em vez de
      // mostrar zero como se fosse leitura registrada.
      setState("sem-armazenamento");
    }
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>SEU INÍCIO</p>
        <h1>Continue de onde você parou.</h1>
        <p>Retome sua leitura.</p>
      </header>

      <section className={styles.resume} aria-labelledby="retomar-title">
        <p className={styles.eyebrow}>RETOMAR LEITURA</p>
        <h2 id="retomar-title">
          {state === "lendo"
            ? "Verificando esta sessão…"
            : snapshot.resume
              ? (snapshot.resume.label ?? snapshot.resume.path)
              : "Nenhum capítulo aberto nesta sessão"}
        </h2>
        {state === "pronto" && snapshot.completedCount > 0 ? (
          <p className={styles.muted}>{snapshot.completedCount} capítulos lidos nesta sessão.</p>
        ) : null}
        <Link className={styles.primary} href={snapshot.resume?.path ?? "/biblia"}>
          {snapshot.resume ? "Voltar à leitura" : "Abrir a Bíblia"}
        </Link>
      </section>

    </main>
  );
}
