import Link from "next/link";
import type { BibleFailureReason } from "@/src/server/bible";

// Estado honesto de indisponibilidade. Nunca mostra texto bíblico de reserva,
// não inventa versículo e não promete prazo: diz o que não está disponível e por
// quê, mantendo a atribuição BLIVRE visível.

const message: Record<BibleFailureReason, string> = {
  unavailable:
    "A leitura está indisponível agora: o servidor não conseguiu consultar o banco do corpus.",
  translation_unavailable:
    "A tradução Bíblia Livre (BLIVRE) não está aprovada neste ambiente, então nenhum versículo é exibido.",
  not_published:
    "Este capítulo existe no catálogo, mas nenhum versículo dele está publicado. Nada é exibido sem publicação.",
  not_found: "Esta referência não existe no corpus importado.",
  invalid_reference: "A referência pedida não é válida.",
  invalid_data: "O capítulo retornou dados fora do formato esperado e foi recusado.",
};

export function ReaderUnavailable({
  reason,
  reference,
}: {
  reason: BibleFailureReason;
  reference?: string;
}) {
  return (
    <main className="readerShell">
      <header className="readerTop">
        <div className="readerMenu" />
        <div className="readerPick">
          <span className="readerTranslation">BLIVRE</span>
        </div>
        <div className="readerActions" />
      </header>
      <article className="scripture">
        <p className="scriptureMeta">LEITURA INDISPONÍVEL</p>
        <h1>
          {reference ? reference : "Leitura"} <span>·</span>
        </h1>
        <div className="chapterRule" />
        <p>{message[reason]}</p>
        <p className="readerProgress">
          Nenhum texto é exibido quando a fonte não pode ser verificada. Enquanto isso, os estudos
          por referência continuam disponíveis.
        </p>
      </article>
      <footer className="readerFooter">
        <Link href="/estudos">Contexto e estudos</Link>
        <span>Texto: Bíblia Livre (BLIVRE) · CC BY 4.0 BR</span>
        <Link href="/direitos-autorais">Direitos</Link>
      </footer>
    </main>
  );
}
