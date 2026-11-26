"use client";

import { useMemo } from "react";
import { transliterateHebrewSurface } from "@/src/domain/transliteration/hebrew";
import styles from "./palavra.module.css";

/** A transliteração roda no aparelho, sem custo adicional de CPU no Worker. */
export function OccurrenceForm({ surface, rtl, verified, excerpt }: {
  readonly surface: string; readonly rtl: boolean; readonly verified: boolean; readonly excerpt: string | null;
}) {
  const transliteration = useMemo(() => verified && rtl ? transliterateHebrewSurface(surface)?.simplified : null, [surface, rtl, verified]);
  return <div className={styles.occurrence}>
    <span lang={rtl ? "he" : "grc"} dir={rtl ? "rtl" : "ltr"}>{surface}</span>
    {transliteration ? <span className={styles.romanization} dir="ltr">{transliteration}</span> : <small>Transliteração indisponível para esta ocorrência</small>}
    {excerpt ? <small>Trecho na Bíblia Livre: <b>{excerpt}</b></small> : null}
  </div>;
}
