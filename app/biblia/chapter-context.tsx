"use client";
import { useState } from "react";
import styles from "./chapter-context.module.css";
export function ChapterContext({ bookName }: { bookName: string }) {
  const [open, setOpen] = useState(false);
  return <><button className={styles.trigger} type="button" onClick={() => setOpen(true)}>Contexto</button>{open ? <div className={styles.backdrop} onClick={() => setOpen(false)} role="presentation"><section className={styles.sheet} role="dialog" aria-modal="true" aria-label={`Contexto de ${bookName}`} onClick={(e)=>e.stopPropagation()}><header><h2>{bookName}</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Fechar contexto">×</button></header><p>Informações de autoria, destinatários, período e temas serão exibidas aqui conforme forem revisadas pela curadoria.</p><p>Este texto ainda não substitui uma ficha histórica validada para este livro.</p></section></div> : null}</>;
}
