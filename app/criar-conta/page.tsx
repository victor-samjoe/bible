import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessForm } from "../_components/access-form";
import { submitAccess } from "../_actions/account-access";
import { getAccountSession } from "@/src/server/auth/runtime";

export const metadata = {
  title: "Criar conta | Bíblia Bereana",
  description: "Criação de conta na Bíblia Bereana por código de uso único enviado por e-mail.",
};

export const dynamic = "force-dynamic";

/**
 * Cadastro (frente A do plano de contas). Mesmo fluxo de `/entrar`, com uma
 * diferença que fica no servidor: aqui a verificação pode criar a conta.
 *
 * O cadastro coleta um dado só, o e-mail, e nenhum outro campo é oferecido:
 * nome, telefone e data de nascimento não são necessários para ler a Bíblia.
 */
export default async function CreateAccountPage() {
  const session = await getAccountSession();
  if (session.state === "authenticated" || session.state === "degraded") redirect("/conta");
  const configured = session.state !== "unconfigured";

  return <main className="page" aria-labelledby="create-account-title">
    <p className="eyebrow">CONTA</p>
    {configured ? <>
      <h1 id="create-account-title">Crie sua conta.</h1>
      <p className="muted">Sem senha: confirme um código enviado ao seu e-mail.</p>
      <AccessForm
        action={submitAccess.bind(null, "sign_up")}
        requestLabel="Enviar código de criação"
        requestHint="A conta começa como leitora. Você pode solicitar exclusão a qualquer momento."
      />
    </> : <>
      <h1 id="create-account-title">Crie sua conta quando o acesso seguro estiver ativo.</h1>
      <p className="muted">O cadastro será por e-mail e código de uso único. Nesta etapa, nenhum dado é coletado, enviado ou guardado.</p>
      <section className="notice" aria-label="Status do cadastro"><strong>Integração de autenticação pendente.</strong><br />A criação de contas e a confirmação de e-mail dependem da configuração do provedor.</section>
      <form className="catalog" aria-describedby="create-account-title">
        <label>E-mail<input type="email" placeholder="Disponível quando o cadastro for ativado" disabled /></label>
        <button className="button" type="button" disabled>Enviar código de criação</button>
      </form>
    </>}
    <p className="catalog">
      <Link className="text-link" href="/entrar">Já tem uma conta? Ir para o acesso</Link>
      <Link className="text-link" href="/privacidade">Como tratamos seus dados</Link>
    </p>
  </main>;
}
