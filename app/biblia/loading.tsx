/** Mantém a superfície do leitor durante uma abertura fria, sem tela branca. */
export default function BibliaLoading() {
  return (
    <main
      className="readerShell"
      aria-busy="true"
      aria-label="Carregando leitura"
      style={{ minHeight: "100svh", background: "#000", display: "grid", placeItems: "center" }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: 12, color: "#c9c4ba", fontFamily: "Arial, Helvetica, sans-serif", fontSize: ".82rem" }}>
        <span aria-hidden="true" style={{ width: 30, height: 30, border: "3px solid #555", borderTopColor: "#d6aa4f", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        Carregando capítulo
      </div>
    </main>
  );
}
