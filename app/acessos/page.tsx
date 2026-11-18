import Link from "next/link";

export const metadata = { title: "Acessos | Bíblia Bereana" };

const roles = [
  ["Leitor", "Leitura, notas e preferências próprias após autenticação."],
  ["Editor", "Fluxo editorial, sujeito a revisão e permissões no servidor."],
  ["Administrador", "Gestão de papéis e controles de segurança no servidor."],
] as const;

export default function AccessControlPage() {
  return <main className="page" aria-labelledby="access-title">
    <p className="eyebrow">CONTROLE DE ACESSO</p>
    <h1 id="access-title">Papéis preparados, acesso ainda não configurado.</h1>
    <p className="muted">Nenhuma pessoa, sessão ou permissão é mostrada aqui. Papéis só poderão ser atribuídos depois da autenticação com validação no servidor.</p>
    <section className="catalog" aria-label="Papéis disponíveis">
      {roles.map(([role, description]) => <article className="study-card" key={role}><span className="tag">INTEGRAÇÃO PENDENTE</span><h2>{role}</h2><p>{description}</p><button className="button" type="button" disabled>Gerenciar quando disponível</button></article>)}
    </section>
    <p><Link className="text-link" href="/criar-conta">Ir para criação de conta</Link></p>
  </main>;
}
