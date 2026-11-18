"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type Target = { href: string; label: string } | null;

/** Mantém o capítulo atual visível até a navegação pré-carregada terminar. */
export function ChapterQuickNavigation({ previous, next }: { previous: Target; next: Target }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (previous) router.prefetch(previous.href);
    if (next) router.prefetch(next.href);
  }, [next, previous, router]);

  const navigate = (href: string) => startTransition(() => router.push(href));

  return (
    <nav className="chapterQuickNav" aria-label="Navegação entre capítulos">
      {previous ? <Link href={previous.href} rel="prev" aria-label={`Capítulo anterior: ${previous.label}`} onClick={(event) => { event.preventDefault(); navigate(previous.href); }}>← <span>{previous.label}</span></Link> : <span />}
      {next ? <Link href={next.href} rel="next" aria-label={`Próximo capítulo: ${next.label}`} onClick={(event) => { event.preventDefault(); navigate(next.href); }}><span>{next.label}</span> →</Link> : <span />}
    </nav>
  );
}
