import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Leitor bíblico em preparação | SamJoE Estudos",
  description:
    "O leitor usará a Bíblia Livre (BLIVRE), licenciada em Creative Commons Atribuição 4.0 Brasil. Nenhum versículo é exibido antes da validação da importação.",
};

export default function BiblePage() {
  return (
    <>
      <nav className="nav" aria-label="Navegação principal">
        <Link className="brand" href="/">
          samjoe<span aria-hidden="true">•</span>estudos
        </Link>
        <Link href="/estudos">Estudos</Link>
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
            <Link className="button" href="/estudos/romanos-9-contexto">
              Abrir o estudo Romanos 9: por onde começar
            </Link>
            <Link className="text-link" href="/direitos-autorais">
              Ver direitos autorais e fontes <span aria-hidden="true">→</span>
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
