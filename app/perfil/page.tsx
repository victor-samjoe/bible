import Link from "next/link";
import { maskEmail, roleLabel } from "@/src/domain/account-access";
import { getAccountSession } from "@/src/server/auth/runtime";
import styles from "./page.module.css";

export const metadata = {
  title: "Perfil | Bíblia Bereana",
  description: "Área pessoal da Bíblia Bereana: identidade da conta e o que ainda não existe.",
};

export const dynamic = "force-dynamic";

/**
 * Perfil (frente A do plano de contas).
 *
 * Esta página mudou de "aguardando autenticação" para "reflete a sessão real",
 * porque a frase anterior passaria a ser mentira assim que a identidade fosse
 * configurada. O que ela continua fazendo é não prometer: preferências, notas e
 * progresso seguem locais ao navegador até a persistência pessoal existir, e
 * dispositivos e duas etapas continuam indisponíveis — são recursos que não
 * foram construídos, e dizer o contrário aqui seria inventar.
 */
export default async function ProfilePage() {
  const session = await getAccountSession();

  return <main className={styles.page} data-compact-page="profile">
    <section className={styles.intro} aria-labelledby="profile-title">
      <p className={styles.eyebrow}>PERFIL</p>
      {session.state === "authenticated" ? <>
        <h1 id="profile-title">Sua identidade nesta conta.</h1>
        <p>Seus dados de acesso.</p>
        <dl className={styles.identity}>
          <div><dt>E-mail</dt><dd>{session.email === null ? "não informado pelo provedor" : maskEmail(session.email)}</dd></div>
          <div><dt>Papel</dt><dd>{roleLabel(session.viewer.role)}</dd></div>
        </dl>
        <Link className={styles.login} href="/conta">Ir para conta</Link>
      </> : null}
      {session.state === "degraded" ? <>
        <h1 id="profile-title">Perfil indisponível agora.</h1>
        <p>Tente novamente em alguns minutos.</p>
      </> : null}
      {session.state === "anonymous" ? <>
        <h1 id="profile-title">Seu perfil.</h1>
        <p>Entre para ver seus dados.</p>
        <Link className={styles.login} href="/entrar">Entrar</Link>
      </> : null}
      {session.state === "unconfigured" ? <>
        <h1 id="profile-title">Seu perfil.</h1>
        <Link className={styles.login} href="/entrar">Entrar</Link>
      </> : null}
    </section>
  </main>;
}
