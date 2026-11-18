"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "./app-shell";
import styles from "./application-frame.module.css";

/** O leitor mantém seu menu imersivo; todas as demais rotas usam a casca fixa. */
export function ApplicationFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [transition, setTransition] = useState<"idle" | "loading" | "leaving">("idle");
  const startedAt = useRef(0);
  const hasNavigated = useRef(false);
  const previousPathname = useRef(pathname);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.sessionStorage.getItem("reader-session-v3") ?? "{}") as { preferences?: { fontFamily?: string; fontSize?: string; spacing?: string } };
      const preference = stored.preferences;
      if (!preference) return;
      const fonts: Record<string, string> = { serif: 'Georgia, "Times New Roman", serif', sans: "Arial, Helvetica, sans-serif", literaria: '"Palatino Linotype", Palatino, serif', humana: "Verdana, Geneva, sans-serif", monospace: "ui-monospace, SFMono-Regular, Consolas, monospace" };
      const sizes: Record<string, string> = { "muito-pequeno": "0.84rem", menor: "0.98rem", pequeno: "1.14rem", medio: "1.33rem", grande: "1.58rem" };
      const lines: Record<string, string> = { continuo: "1.38", compacto: "1.5", padrao: "1.78", amplo: "2" };
      const root = document.documentElement.style;
      if (preference.fontFamily && fonts[preference.fontFamily]) root.setProperty("--reader-fontFamily", fonts[preference.fontFamily]);
      if (preference.fontSize && sizes[preference.fontSize]) root.setProperty("--reader-fontSize", sizes[preference.fontSize]);
      if (preference.spacing && lines[preference.spacing]) root.setProperty("--reader-lineHeight", lines[preference.spacing]);
    } catch { /* armazenamento opcional: mantém os padrões */ }
  }, []);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    if (!hasNavigated.current || transition === "idle") return;
    const remaining = Math.max(0, 1000 - (Date.now() - startedAt.current));
    const reveal = window.setTimeout(() => setTransition("leaving"), remaining);
    const clear = window.setTimeout(() => setTransition("idle"), remaining + 220);
    return () => { window.clearTimeout(reveal); window.clearTimeout(clear); };
  }, [pathname, transition]);

  const startTransition = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.pathname === pathname) return;
    hasNavigated.current = true;
    startedAt.current = Date.now();
    setTransition("loading");
  };

  const frame = pathname === "/biblia" || pathname.startsWith("/biblia/") ? children : <AppShell>{children}</AppShell>;
  return <div className={styles.root} onClickCapture={startTransition}>
    <div key={pathname} className={styles.page}>{frame}</div>
    {transition !== "idle" ? <div className={`${styles.loading} ${transition === "leaving" ? styles.leaving : ""}`} aria-hidden="true"><span /></div> : null}
  </div>;
}
