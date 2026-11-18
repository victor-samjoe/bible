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
import { platformUpdates } from "@/src/content/platform-updates";
import styles from "./dashboard.module.css";

// Painel pessoal (tarefa C15). Tudo que aparece como número vem do registro
// local desta sessão do navegador, lido depois da hidratação. Não há banco,
// conta, sincronização ou estimativa: sem registro, cada bloco diz que está
// vazio e mostra o caminho para começar a ler.

const MAX_VISIBLE_CHAPTERS = 12;

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

  const visibleChapters = snapshot.completed.slice(0, MAX_VISIBLE_CHAPTERS);
  const hiddenChapters = snapshot.completedCount - visibleChapters.length;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>SEU INÍCIO</p>
        <h1>Continue de onde você parou.</h1>
        <p>
          Este painel lê apenas o registro desta sessão do navegador. Sem conta, nada é enviado,
          sincronizado entre dispositivos ou guardado depois que a aba fecha.
        </p>
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
        {state === "lendo" ? (
          <p className={styles.muted}>Lendo o registro local desta sessão…</p>
        ) : state === "sem-armazenamento" ? (
          <p className={styles.muted}>
            Este navegador não liberou o armazenamento da sessão, então não há registro de leitura
            para mostrar. A leitura continua funcionando normalmente.
          </p>
        ) : snapshot.resume ? (
          <p className={styles.muted}>
            Registrado localmente ao abrir o capítulo
            {snapshot.resume.label ? ` (${snapshot.resume.path})` : ""}.
          </p>
        ) : (
          <p className={styles.muted}>
            Abra um capítulo na Bíblia e ele aparecerá aqui enquanto esta sessão durar.
          </p>
        )}
        <Link className={styles.primary} href={snapshot.resume?.path ?? "/biblia"}>
          {snapshot.resume ? "Voltar à leitura" : "Abrir a Bíblia"} <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className={styles.grid} aria-label="Registro local de leitura">
        <article className={styles.card}>
          <span className={styles.status}>NESTA SESSÃO</span>
          <h2>
            {state === "pronto" ? snapshot.completedCount : "—"}{" "}
            <small>
              {snapshot.completedCount === 1
                ? "capítulo marcado como lido"
                : "capítulos marcados como lidos"}
            </small>
          </h2>
          {state === "pronto" && visibleChapters.length > 0 ? (
            <>
              <ul className={styles.chapters}>
                {visibleChapters.map((chapter) => (
                  <li key={chapter.scope}>
                    <Link href={chapter.path}>{chapter.scope}</Link>
                  </li>
                ))}
              </ul>
              {hiddenChapters > 0 ? (
                <p className={styles.muted}>
                  e outros {hiddenChapters} capítulos marcados nesta sessão.
                </p>
              ) : null}
              <p className={styles.muted}>
                A referência aparece como <code>livro.capítulo</code> porque o nome do livro vem do
                corpus, no próprio capítulo.
              </p>
            </>
          ) : (
            <p className={styles.muted}>
              “Lido” é uma ação do capítulo, no cabeçalho do leitor. O que você marcar aqui vale
              apenas nesta sessão.
            </p>
          )}
        </article>

        <article className={styles.card}>
          <span className={styles.status}>NESTA SESSÃO</span>
          <h2>
            {state === "pronto" ? snapshot.noteCount : "—"}{" "}
            <small>{snapshot.noteCount === 1 ? "nota escrita" : "notas escritas"}</small>
          </h2>
          <p className={styles.muted}>
            {state === "pronto" && snapshot.highlightCount > 0
              ? snapshot.highlightCount === 1
                ? "Também há 1 versículo destacado por cor nesta sessão."
                : `Também há ${snapshot.highlightCount} versículos destacados por cor nesta sessão.`
              : "Notas e destaques são escritos no leitor, a partir dos versículos selecionados."}
          </p>
          <p className={styles.muted}>
            A biblioteca de notas em página própria depende de conta autenticada, que ainda não
            existe. Por isso a área “Notas” aparece como indisponível no menu.
          </p>
        </article>
      </section>

      <section className={styles.updates} aria-labelledby="novidades-title">
        <p className={styles.eyebrow}>NOVIDADES E ESTADO DA PLATAFORMA</p>
        <h2 id="novidades-title">O que já funciona, e o que não.</h2>
        <p className={styles.muted}>
          Lista editorial mantida à mão, conferível no registro de implementação do projeto. Não é
          um feed automático e não anuncia data de lançamento.
        </p>
        <ul className={styles.updateList}>
          {platformUpdates.map((update) => (
            <li key={update.id}>
              <span
                className={update.status === "disponivel" ? styles.ok : styles.pending}
              >
                {update.status === "disponivel" ? "DISPONÍVEL" : "INDISPONÍVEL"}
              </span>
              <h3>{update.title}</h3>
              <p>{update.summary}</p>
              <time dateTime={update.date}>{update.date}</time>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.note}>
        Nenhum dado desta tela sai do seu navegador. Login, sincronização, cursos pagos e
        comparação entre traduções continuam indisponíveis até existirem de verdade.
      </p>
    </main>
  );
}
