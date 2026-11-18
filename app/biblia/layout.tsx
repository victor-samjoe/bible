import type { ReactNode } from "react";
import { ReadingPointer } from "./reading-pointer";
import "./reader.css";
import "./reader-preferences.css";
import "./reader-verses.css";
import "./theme.css";
import "./reader-header.css";
import "./reader-balance.css";
import "./reader-theme-surfaces.css";
import "./reader-transition.css";

// Estilos do leitor ficam no layout para valerem tanto em /biblia quanto em
// /biblia/[book]/[chapter], sem duplicar import em cada rota.
//
// `ReadingPointer` (tarefa C15) não renderiza nada: só registra, na sessão do
// navegador, qual capítulo foi aberto, para o painel de início oferecer
// "retomar leitura". O leitor em si não muda.
export default function BibliaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`html,body{background:#191a1b;color-scheme:dark}`}</style>
      <ReadingPointer />
      {children}
    </>
  );
}
