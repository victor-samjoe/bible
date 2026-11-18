"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./reader-side-menu.module.css";

const entries = [
  // "Início" é o painel da tarefa C15: ele é a única entrada acrescentada aqui,
  // para o painel ser alcançável a partir do leitor.
  { href: "/inicio", label: "Início" },
  { href: "/biblia", label: "Bíblia" },
  { href: "/estudos", label: "Estudos" },
  { href: "/materiais", label: "Materiais" },
  { href: "/notas", label: "Minhas notas" },
  { href: "/cursos", label: "Cursos" },
  { href: "/planos", label: "Planos" },
  { href: "/perfil", label: "Perfil" },
] as const;

/** Menu de navegação principal. Ele abre pelo botão e também pelo gesto para a
 * direita no texto, disparado pelo ReaderChapter. */
export function ReaderSideMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener("reader-open-menu", openMenu);
    return () => window.removeEventListener("reader-open-menu", openMenu);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={styles.root}>
      <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-label="Abrir menu">
        <span aria-hidden="true">☰</span>
      </button>
      {open ? (
        <div className={styles.backdrop} role="presentation" onClick={() => setOpen(false)}>
          <aside className={styles.drawer} aria-label="Menu principal" onClick={(event) => event.stopPropagation()}>
            <header>
              <div><b>Bíblia Bereana</b><span>Leitura e estudo</span></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu">×</button>
            </header>
            <nav>
              {entries.map((entry) => (
                <Link key={entry.href} href={entry.href} onClick={() => setOpen(false)}>{entry.label}</Link>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
