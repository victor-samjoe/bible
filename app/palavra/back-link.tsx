"use client";

import Link from "next/link";

export function BackLink({ href, scope, className }: { readonly href: string; readonly scope: string | null; readonly className: string }) {
  return <Link href={href} className={className} onClick={(event) => {
    try {
      const raw = sessionStorage.getItem("reader-word-study-return");
      const saved = raw ? JSON.parse(raw) as { scope?: unknown } : null;
      if (scope && saved?.scope === scope && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
      }
    } catch { /* Sem sessão, o link normal ainda leva ao capítulo. */ }
  }}>← Voltar</Link>;
}
