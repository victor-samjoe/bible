"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  appAreas,
  isAreaActive,
  isAreaAvailable,
  unavailableReason,
} from "@/src/domain/app-navigation";
import styles from "./app-shell.module.css";

// Casca do aplicativo (tarefa C15): navegação lateral fixa no desktop e gaveta
// no celular. A lista de áreas vem de `src/domain/app-navigation.ts`, então a
// casca não decide o que existe: área indisponível aparece como texto com o
// motivo, nunca como link que levaria a 404 ou a uma promessa de conta.
//
// Esta casca não envolve o leitor (`/biblia`), que tem cabeçalho próprio e
// imersivo definido na tarefa C13.

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const navigationId = useId();
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Trocar de rota fecha a gaveta: no celular ela cobre o conteúdo.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      className={styles.shell}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const touch = event.changedTouches[0];
        touchStart.current = null;
        if (!start || !touch || start.x > 44 || Math.abs(touch.clientY - start.y) >= 55) return;
        if (touch.clientX - start.x > 80) setOpen(true);
      }}
    >
      <a className={styles.skip} href="#conteudo">
        Ir para o conteúdo
      </a>

      <header className={styles.bar}>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls={navigationId}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">☰</span> Áreas
        </button>
        <span className={styles.brand}>BÍBLIA BEREANA</span>
      </header>

      {open ? (
        <div className={styles.backdrop} role="presentation" onClick={() => setOpen(false)} />
      ) : null}

      <nav
        id={navigationId}
        className={`${styles.side} ${open ? styles.sideOpen : ""}`}
        aria-label="Áreas do aplicativo"
      >
        <div className={styles.sideHeader}>
          <span className={styles.sideBrand}>
            <b>Bíblia Bereana</b>
            <span>Leitura e estudo</span>
          </span>
          <button
            type="button"
            ref={closeButton}
            className={styles.closeButton}
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true">×</span> Fechar
          </button>
        </div>

        <ul className={styles.areas}>
          {appAreas.map((area) => {
            const reason = unavailableReason(area);
            const active = isAreaActive(pathname, area);
            return (
              <li key={area.id}>
                {isAreaAvailable(area) ? (
                  <Link
                    href={area.href}
                    className={active ? `${styles.area} ${styles.areaActive}` : styles.area}
                    aria-current={active ? "page" : undefined}
                  >
                    {area.label}
                  </Link>
                ) : (
                  <div className={`${styles.area} ${styles.areaOff}`}>
                    <b>
                      {area.label} <em>indisponível</em>
                    </b>
                    <small>{reason}</small>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className={styles.sideNote}>
          As áreas marcadas como indisponíveis dependem de autenticação ou de licença ainda não
          liberada. Nada nesta tela cria conta ou cobra.
        </p>
      </nav>

      {/* `tabIndex` negativo deixa o atalho "ir para o conteúdo" mover o foco de
          verdade; sem isso o salto só muda o scroll em alguns navegadores. */}
      <div className={styles.content} id="conteudo" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
