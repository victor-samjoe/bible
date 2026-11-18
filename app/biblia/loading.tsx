/** Mantém a superfície do leitor durante uma abertura fria, sem tela branca. */
export default function BibliaLoading() {
  return (
    <main
      className="readerShell"
      aria-busy="true"
      aria-label="Carregando leitura"
      style={{ minHeight: "100svh", background: "#191a1b", display: "grid", placeItems: "center", animation: "readerLoadingIn 180ms ease-out" }}
    >
      <style>{`@keyframes readerLoadingIn{from{opacity:0}to{opacity:1}}@keyframes readerLoadingPulse{50%{opacity:.45}}`}</style>
      <div style={{ display: "grid", justifyItems: "center", gap: 10, color: "#c9c4ba", fontFamily: "Arial, Helvetica, sans-serif", fontSize: ".8rem", letterSpacing: ".03em" }}>
        <span aria-hidden="true" style={{ width: 38, height: 1, background: "#d6aa4f", animation: "readerLoadingPulse 1.1s ease-in-out infinite" }} />
        Preparando leitura
      </div>
    </main>
  );
}
