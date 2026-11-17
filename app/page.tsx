import Link from "next/link";
import { redirect } from "next/navigation";
import "./home.css";

const books = ["Gênesis", "Salmos", "Provérbios", "Mateus", "João", "Romanos"];

export default function HomePage() {
  redirect("/biblia");
  return <main className="home">
    <nav className="homeNav">
      <Link className="homeBrand" href="/">bíblia <span>bereana</span></Link>
      <div><Link href="/estudos">Estudos</Link><Link href="/planos">Aprofundar</Link><Link className="homeLogin" href="/entrar">Entrar</Link></div>
    </nav>

    <section className="readerHero">
      <div className="readerIntro">
        <p className="readerEyebrow">A BÍBLIA PRIMEIRO</p>
        <h1>Abra. Leia.<br /><em>Permaneça no texto.</em></h1>
        <p>Uma experiência de leitura simples, com contexto e estudos disponíveis quando você quiser ir além.</p>
        <Link className="readButton" href="/biblia">Abrir a Bíblia <span>→</span></Link>
        <p className="readerStatus">Leitor em preparação com a tradução Bíblia Livre (BLIVRE).</p>
      </div>

      <aside className="readerCard" aria-label="Escolha uma leitura bíblica">
        <p className="readerCardLabel">COMECE A LER</p>
        <div className="readerSelection"><span>Livro</span><strong>João</strong><span aria-hidden="true">⌄</span></div>
        <div className="readerSelection"><span>Capítulo</span><strong>1</strong><span aria-hidden="true">⌄</span></div>
        <Link href="/biblia" className="readerOpen">Ir para a leitura <span>→</span></Link>
        <p className="readerCardHint">Escolha por onde começar. Sem pressa, sem distração.</p>
      </aside>
    </section>

    <section className="bookShelf" aria-labelledby="books-title">
      <div><p className="readerEyebrow">ENCONTRE SEU LUGAR</p><h2 id="books-title">Livros para começar</h2></div>
      <div className="bookList">{books.map((book) => <Link key={book} href="/biblia">{book}<span>→</span></Link>)}</div>
    </section>

    <section className="readingPath">
      <p className="readerEyebrow">QUANDO QUISER APROFUNDAR</p>
      <h2>Leitura primeiro.<br />Contexto depois.</h2>
      <p>Estudos não substituem o texto. Eles ajudam a localizar perguntas, fontes e leituras diferentes sem apresentar conclusões prontas como se fossem a própria Escritura.</p>
      <Link href="/estudos/romanos-9-contexto" className="plainLink">Ler o estudo de Romanos 9 <span>→</span></Link>
    </section>

    <footer className="homeFooter"><span>© 2026 SamJoE Tech &amp; Consulting</span><div><Link href="/direitos-autorais">Fontes e direitos</Link><Link href="/privacidade">Privacidade</Link><Link href="/contato">Contato</Link></div></footer>
  </main>;
}
