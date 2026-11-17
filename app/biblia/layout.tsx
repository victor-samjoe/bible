import type { ReactNode } from "react";
import "./reader.css";
import "./reader-preferences.css";
import "./reader-verses.css";
import "./theme.css";
import "./reader-header.css";
import "./reader-theme-surfaces.css";

// Estilos do leitor ficam no layout para valerem tanto em /biblia quanto em
// /biblia/[book]/[chapter], sem duplicar import em cada rota.
export default function BibliaLayout({ children }: { children: ReactNode }) {
  return children;
}
