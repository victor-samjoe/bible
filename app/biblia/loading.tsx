/** Mantém a superfície do leitor durante uma abertura fria, sem tela branca. */
export default function BibliaLoading() {
  return (
    <main className="readerShell" aria-busy="true" aria-label="Carregando leitura">
      <header className="readerTop">
        <span className="readerMark">☰</span>
        <div className="readerPick"><span>Carregando</span><b>…</b></div>
        <span />
      </header>
      <article className="scripture" aria-hidden="true">
        <p className="scriptureMeta">BÍBLIA BEREANA</p>
        <h1 style={{ textAlign: "center" }}>Preparando <span>a leitura</span></h1>
        <div className="chapterRule" />
        <p>O capítulo será exibido assim que estiver pronto.</p>
      </article>
    </main>
  );
}
