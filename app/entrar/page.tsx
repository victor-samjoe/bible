import Link from "next/link";
import { redirect } from "next/navigation";
import { AccessForm } from "../_components/access-form";
import { submitAccess } from "../_actions/account-access";
import { getAccountSession } from "@/src/server/auth/runtime";
import styles from "./page.module.css";

export const metadata = {
  title: "Entrar | Bíblia Bereana",
  description: "Acesso à conta da Bíblia Bereana por código de uso único enviado por e-mail.",
};

/** Lê cookie e identidade: não pode ser estática nem ficar em cache público. */
export const dynamic = "force-dynamic";

/**
 * Entrada na conta (frente A do plano de contas).
 *
 * Um método só: código de uso único por e-mail. Não há senha para vazar, não há
 * recuperação de senha para sequestrar e nada é guardado no navegador além do
 * cookie de sessão `httpOnly`.
 *
 * A página tem dois estados reais. Sem identidade configurada no ambiente, ela
 * diz exatamente isso e nenhum campo aceita digitação — é o estado em que o
 * projeto está enquanto as chaves do Supabase não forem preenchidas. Com
 * identidade configurada, o formulário funciona de verdade.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAccountSession();
  if (session.state === "authenticated" || session.state === "degraded") redirect("/conta");
  const configured = session.state !== "unconfigured";
  // Único erro que a query carrega, e sem detalhe: ver `app/auth/callback/route.ts`.
  const linkFailed = (await searchParams).erro === "link";

  return <main className={styles.page} data-compact-page="login">
    <section className={styles.content} aria-labelledby="login-title">
      <p className={styles.eyebrow}>ÁREA PESSOAL</p>
      {configured ? <>
        <h1 id="login-title">Entre na sua conta.</h1>
        <p className={styles.lede}>Informe seu e-mail para receber um código de acesso. Sem senha.</p>
        {linkFailed ? <div className={styles.notice} role="status">
          <strong>O link do e-mail não pôde ser usado.</strong> Ele vale uma vez e expira em poucos minutos. Peça um novo código abaixo.
        </div> : null}
        <AccessForm
          action={submitAccess.bind(null, "sign_in")}
          requestLabel="Receber código de acesso"
          requestHint="Usamos seu e-mail apenas para enviar o código. Ainda não tem conta? Crie uma em seguida."
        />
      </> : <>
        <h1 id="login-title">Acesso em preparação.</h1>
        <p className={styles.lede}>A conta permitirá sincronizar sua leitura entre dispositivos.</p>
        <div className={styles.notice} role="status" id="integracao-pendente">
          <strong>Integração de autenticação pendente.</strong> Nenhum e-mail, senha ou código é solicitado ou enviado nesta etapa.
        </div>
        <form className={styles.form} aria-describedby="integracao-pendente">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="Disponível quando o acesso for ativado" disabled />
          <button type="button" disabled aria-disabled="true">Receber link de acesso</button>
          <p>O acesso por código de uso único será oferecido depois da integração.</p>
        </form>
      </>}
      <nav className={styles.links} aria-label="Opções de conta">
        <Link href="/criar-conta">{configured ? "Criar conta" : "Criar conta quando disponível"}</Link>
        <Link href="/conta#recuperacao">{configured ? "Perdi o acesso ao e-mail" : "Recuperar acesso quando disponível"}</Link>
      </nav>
    </section>
  </main>;
}
