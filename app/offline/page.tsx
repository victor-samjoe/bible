import Link from "next/link";

export default function OfflinePage() {
  return <main className="page"><p className="eyebrow">SEM CONEXÃO</p><h1>Sua leitura continua quando a rede voltar.</h1><p className="muted">O aplicativo mantém somente a interface básica offline. Sessão, estudos e conteúdo premium continuam protegidos e exigem conexão.</p><p><Link className="text-link" href="/">Tentar novamente →</Link></p></main>;
}
