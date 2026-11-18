import Link from "next/link";
import { roleLabel } from "@/src/domain/account-access";
import { getAccountSession } from "@/src/server/auth/runtime";

export const metadata = {
  title: "Acessos | Bíblia Bereana",
  description: "Papéis e controle de acesso da Bíblia Bereana.",
};

export const dynamic = "force-dynamic";

/**
 * Controle de acesso (frente A do plano de contas).
 *
 * A página mostra o papel da própria pessoa — lido de `profiles` no servidor,
 * nunca de cookie, formulário ou metadado do provedor — e explica a hierarquia.
 *
 * O que ela **não** faz, de propósito: não lista pessoas, não lista sessões e
 * não atribui papéis. Atribuir papel exige papel `admin` e uma trilha de
 * auditoria que não foi construída; oferecer o botão antes disso seria uma
 * promessa falsa, e construir a atribuição sem auditoria seria pior do que não
 * ter a tela.
 */
export default async function AccessControlPage() {
  const session = await getAccountSession();
  const viewer = session.state === "authenticated" ? session.viewer : null;

  return <main className="page" aria-labelledby="access-title">
    <p className="eyebrow">CONTROLE DE ACESSO</p>
    <h1 id="access-title">Acessos da conta.</h1>
    <p className="muted">Seu nível de acesso.</p>

    <section className="notice" aria-label="Seu papel">
      {viewer === null
        ? <><strong>Sem sessão ativa.</strong><br />Entre para ver seu acesso.</>
        : <><strong>{roleLabel(viewer.role)}.</strong></>}
    </section>

    <p>
      {viewer === null
        ? <Link className="text-link" href="/entrar">Entrar na conta</Link>
        : <Link className="text-link" href="/conta">Ir para conta</Link>}
    </p>
  </main>;
}
