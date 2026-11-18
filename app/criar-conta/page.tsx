import Link from "next/link";

export const metadata = { title: "Criar conta | Bíblia Bereana" };

export default function CreateAccountPage() {
  return <main className="page" aria-labelledby="create-account-title">
    <p className="eyebrow">CONTA</p>
    <h1 id="create-account-title">Crie sua conta quando o acesso seguro estiver ativo.</h1>
    <p className="muted">O cadastro será por e-mail e link seguro. Nesta etapa, nenhum dado é coletado, enviado ou guardado.</p>
    <section className="notice" aria-label="Status do cadastro"><strong>Integração de autenticação pendente.</strong><br />A criação de contas e a confirmação de e-mail dependem da configuração do provedor.</section>
    <form className="catalog" aria-describedby="create-account-title">
      <label>E-mail<input type="email" placeholder="Disponível quando o cadastro for ativado" disabled /></label>
      <button className="button" type="button" disabled>Enviar link de criação</button>
    </form>
    <p><Link className="text-link" href="/entrar">Já tem uma conta? Ver acesso</Link></p>
  </main>;
}
