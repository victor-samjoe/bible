"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { appAreas, isAreaAvailable, unavailableReason } from "@/src/domain/app-navigation";
import styles from "./reader-side-menu.module.css";

// As entradas vêm de `src/domain/app-navigation.ts` (tarefa C15), que é a mesma
// lista usada pela casca do aplicativo. Antes elas estavam escritas à mão aqui e
// A lista é a mesma da casca do aplicativo. Assim, uma área só aparece como
// link no leitor quando existe uma página publicada para ela.

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
              {appAreas.map((area) =>
                isAreaAvailable(area) ? (
                  <Link key={area.id} href={area.href} onClick={() => setOpen(false)}>{area.label}</Link>
                ) : (
                  <span key={area.id} className={styles.off}>
                    {area.label} <em>indisponível</em>
                    <small>{unavailableReason(area)}</small>
                  </span>
                ),
              )}
            </nav>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
