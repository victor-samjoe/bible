import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/src/server/auth/runtime";
import styles from "./page.module.css";

export const metadata = {
  title: "Entrar | Bíblia Bereana",
  description: "Acesso à conta da Bíblia Bereana com Google.",
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
  const loginError = (await searchParams).erro;
  const googleFailed = loginError === "google";

  return <main className={styles.page} data-compact-page="login">
    <section className={styles.content} aria-labelledby="login-title">
      <p className={styles.eyebrow}>ÁREA PESSOAL</p>
      {configured ? <>
        <h1 id="login-title">Entre na sua conta.</h1>
        <p className={styles.lede}>Entre com sua conta Google. Não usamos senha nem código por e-mail.</p>
        {googleFailed ? <div className={styles.notice} role="status">
          <strong>Não foi possível concluir o acesso pelo Google.</strong> Tente novamente em instantes.
        </div> : null}
        <a href="/auth/google" style={{ alignItems: "center", border: "1px solid #77786f", borderRadius: 3, color: "#f5f2ea", display: "flex", fontWeight: 800, gap: 10, justifyContent: "center", padding: "13px 18px", textAlign: "center", textDecoration: "none" }}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.25c0-.72-.06-1.2-.2-1.7H12v3.47h5.37c-.11.86-.72 2.16-2.08 3.03l-.02.12 3.02 2.29.21.02c1.94-1.75 3.05-4.32 3.05-7.23Z"/><path fill="#34A853" d="M12 21.6c2.63 0 4.84-.85 6.45-2.32l-3.07-2.31c-.82.56-1.92.95-3.38.95-2.57 0-4.75-1.66-5.53-3.96l-.12.01-3.14 2.38-.04.11C4.77 19.58 8.12 21.6 12 21.6Z"/><path fill="#FBBC05" d="M6.47 13.96A5.77 5.77 0 0 1 6.16 12c0-.68.12-1.34.3-1.96v-.13L3.28 7.5l-.1.04A9.48 9.48 0 0 0 2.1 12c0 1.61.39 3.13 1.08 4.46l3.29-2.5Z"/><path fill="#EA4335" d="M12 6.08c1.84 0 3.09.78 3.8 1.43l2.77-2.64C16.83 3.27 14.63 2.4 12 2.4c-3.88 0-7.23 2.02-8.83 5.14l3.3 2.5C7.26 7.74 9.43 6.08 12 6.08Z"/></svg>Continuar com Google</a>
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
        <Link href="/criar-conta">{configured ? "Criar conta com Google" : "Criar conta quando disponível"}</Link>
        <Link href="/conta#recuperacao">{configured ? "Preciso de ajuda para acessar" : "Recuperar acesso quando disponível"}</Link>
      </nav>
    </section>
  </main>;
}
