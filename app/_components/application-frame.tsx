"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "./app-shell";

/** O leitor mantém seu menu imersivo; todas as demais rotas usam a casca fixa. */
export function ApplicationFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
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
  return pathname === "/biblia" || pathname.startsWith("/biblia/") ? children : <AppShell>{children}</AppShell>;
}
