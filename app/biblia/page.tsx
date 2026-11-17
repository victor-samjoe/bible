import type { Metadata } from "next";
import Link from "next/link";
import "./reader.css";
import "./theme.css";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  title: "Leitor bíblico em preparação | Bíblia Bereana",
  description:
    "O leitor usará a Bíblia Livre (BLIVRE), licenciada em Creative Commons Atribuição 4.0 Brasil. Nenhum versículo é exibido antes da validação da importação.",
};

export default function BiblePage() {
  return (
    <>
      <main className="readerShell">
        <header className="readerTop">
          <Link className="readerMark" href="/" aria-label="Bíblia Bereana, início">B</Link>
          <div className="readerPick"><span>Gálatas</span><b>1</b><span className="readerTranslation">BLIVRE</span></div>
          <div className="readerActions" aria-label="Ferramentas de leitura"><ThemeToggle /><button type="button" aria-label="Mais opções">•••</button></div>
        </header>
        <article className="scripture" aria-labelledby="chapter-title">
          <p className="scriptureMeta">NOVA ALIANÇA · CARTAS DE PAULO</p>
          <h1 id="chapter-title">Gálatas <span>1</span></h1>
          <div className="chapterRule" />
          <p><sup>1</sup>Paulo, apóstolo (não da parte dos seres humanos, nem por meio de homem algum, mas sim por Jesus Cristo, e por Deus Pai, que o ressuscitou dos mortos),</p>
          <p><sup>2</sup>e todos os irmãos que estão comigo, para as igrejas da Galácia.</p>
          <p><sup>3</sup>Graça seja convosco, e também a paz de Deus Pai, e do nosso Senhor Jesus Cristo,</p>
          <p><sup>4</sup>que deu a si mesmo pelos nossos pecados, para nos tirar da presente era maligna, conforme a vontade do nosso Deus e Pai,</p>
          <p><sup>5</sup>ao qual seja a glória para todo o sempre, Amém!</p>
          <h2>Não há outro evangelho</h2>
          <p><sup>6</sup>Admiro-me de que tão rapidamente desviastes daquele que vos chamou na graça de Cristo, em troca de outro evangelho.</p>
          <p><sup>7</sup>Não que haja outro evangelho, porém há alguns que vos inquietam, e querem perverter o Evangelho de Cristo.</p>
          <p><sup>8</sup>Porém, ainda que nós mesmos, ou um anjo do céu vos anuncie outro evangelho além do que já vos anunciamos, maldito seja.</p>
          <p><sup>9</sup>Como já havíamos dito, volto também agora a dizer: se alguém vos anunciar outro evangelho além do que já recebestes, maldito seja.</p>
          <p><sup>10</sup>Pois agora estou buscando a aprovação das pessoas, ou a de Deus? Ou procuro agradar a pessoas? Pois, se ainda tentasse agradar a pessoas, eu não seria servo de Cristo.</p>
        </article>
        <footer className="readerFooter"><Link href="/estudos">Contexto e estudos</Link><span>Texto: Bíblia Livre (BLIVRE) · CC BY 4.0 BR</span><Link href="/direitos-autorais">Direitos</Link></footer>
      </main>
      <div className="legacyBible"><nav className="nav" aria-label="Navegação principal">
        <Link className="brand" href="/">
          bíblia<span aria-hidden="true">•</span>bereana
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
      </main></div>
    </>
  );
}
