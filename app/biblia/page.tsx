import type { Metadata } from "next";
import "./reader.css";
import "./reader-preferences.css";
import "./reader-verses.css";
import "./theme.css";
import "./reader-header.css";
import { ReaderProvider } from "./reader-state";
import { ReaderChapter } from "./reader-chapter";
import { ThemeToggle } from "./theme-toggle";
import { ReaderTools } from "./reader-tools";
import { chapterReference, provisionalChapter } from "./chapter-data";

export const metadata: Metadata = {
  title: "Leitor bíblico em preparação | Bíblia Bereana",
  description:
    "O leitor usará a Bíblia Livre (BLIVRE), licenciada em Creative Commons Atribuição 4.0 Brasil. Nenhum versículo é exibido antes da validação da importação.",
};

export default function BiblePage() {
  return (
    <>
      {/* ReaderProvider mantém preferências, tema, destaques, notas e progresso em um
          único estado local desta sessão, compartilhado pelo cabeçalho, pelo capítulo e
          pelas ferramentas. Nada aqui consulta banco: o capítulo ainda é o trecho fixo
          de `chapter-data.ts` e a persistência por usuário é a tarefa C5. */}
      <ReaderProvider>
        <main className="readerShell">
          <header className="readerTop">
            <div className="readerMenu"><ReaderTools /></div>
            <div className="readerPick">
              <button type="button" aria-label="Selecionar livro">{provisionalChapter.book}</button>
              <button type="button" aria-label="Selecionar capítulo">{provisionalChapter.chapter}</button>
              <span className="readerTranslation">{provisionalChapter.translation}</span>
            </div>
            <div className="readerActions" aria-label="Ferramentas de leitura">
              <ThemeToggle />
            </div>
          </header>
          <ReaderChapter />
          <footer className="readerFooter">
            <a href="/estudos">Contexto e estudos</a>
            <span>
              {chapterReference} · Texto: Bíblia Livre (BLIVRE) · CC BY 4.0 BR
            </span>
            <a href="/direitos-autorais">Direitos</a>
          </footer>
        </main>
      </ReaderProvider>
      <div className="legacyBible"><nav className="nav" aria-label="Navegação principal">
        <a className="brand" href="/">
          bíblia<span aria-hidden="true">•</span>bereana
        </a>
        <a href="/estudos">Estudos</a>
      </nav>

      <main className="page">
        <p className="eyebrow">LEITOR BÍBLICO</p>
        <h1>O leitor está em preparação.</h1>

        <p className="muted">
          A licença do corpus já está definida e registrada: o leitor usará a Bíblia Livre
          (BLIVRE), em português do Brasil, distribuída sob Creative Commons Atribuição 4.0
          Brasil. O que ainda falta é a etapa técnica — importar o pacote oficial e validar sua
          integridade. Por isso esta página ainda não exibe nenhum versículo.
        </p>

        <section aria-labelledby="atribuicao">
          <h2 id="atribuicao">Atribuição obrigatória</h2>
          <p>
            A licença exige que esta atribuição apareça na página de direitos autorais e em
            contexto razoável no leitor. Ela será exibida junto ao texto desde a primeira
            publicação:
          </p>
          <blockquote cite="https://ebible.org/study/content/texts/porbr2018/about.html">
            <p>
              Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE), Copyright ©
              Diego Santos, Mario Sérgio e Marco Teles, fevereiro de 2018. Licença Creative
              Commons Atribuição 4.0 Brasil.
            </p>
          </blockquote>
          <p className="small">
            Fonte da licença:{" "}
            <a
              className="text-link"
              href="https://ebible.org/study/content/texts/porbr2018/about.html"
            >
              página oficial da BLIVRE (porbr2018) no eBible.org
            </a>
            . A licença não implica endosso dos licenciadores a esta plataforma.
          </p>
        </section>

        <section aria-labelledby="pendencias">
          <h2 id="pendencias">O que falta antes de liberar a leitura</h2>
          <ul>
            <li>
              Importar somente o pacote USFM oficial e conferir seu checksum, a data de
              importação e a versão da fonte.
            </li>
            <li>
              Registrar a versão exata: a própria fonte descreve a tradução como trabalho em
              andamento.
            </li>
            <li>
              Não misturar versículos de outra tradução sob o rótulo BLIVRE e identificar
              claramente qualquer alteração de texto.
            </li>
          </ul>
          <div className="notice">
            Enquanto a importação não for validada, a plataforma apresenta estudos por
            referência, sem reproduzir texto bíblico.
          </div>
        </section>

        <section aria-labelledby="enquanto-isso">
          <h2 id="enquanto-isso">Enquanto isso</h2>
          <p>
            O estudo de contexto de Romanos 9 já está publicado e pode ser lido com sua própria
            Bíblia ao lado.
          </p>
          <p className="actions">
            <a className="button" href="/estudos/romanos-9-contexto">
              Abrir o estudo Romanos 9: por onde começar
            </a>
            <a className="text-link" href="/direitos-autorais">
              Ver direitos autorais e fontes <span aria-hidden="true">→</span>
            </a>
          </p>
        </section>
      </main></div>
    </>
  );
}
