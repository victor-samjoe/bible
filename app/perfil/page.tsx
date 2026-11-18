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
const pendingSections = [
  ["Preferências sincronizadas", "Tema, fonte e espaçamento continuam apenas na sessão atual do leitor; a sincronização por conta ainda não foi construída."],
  ["Leituras e notas", "Notas, destaques e capítulos lidos ainda ficam no navegador e não são vinculados à conta."],
  ["Dispositivos", "A lista de dispositivos conectados não existe: o provedor de identidade não expõe essa informação nesta integração."],
  ["Segurança e duas etapas", "A verificação em duas etapas não foi construída. Hoje o acesso já é sem senha, por código de uso único no e-mail."],
] as const;

export default async function ProfilePage() {
  const session = await getAccountSession();

  return <main className={styles.page}>
    <section className={styles.intro} aria-labelledby="profile-title">
      <p className={styles.eyebrow}>PERFIL</p>
      {session.state === "authenticated" ? <>
        <h1 id="profile-title">Sua identidade nesta conta.</h1>
        <p>Guardamos o mínimo: o e-mail que recebe o código de acesso e o papel da conta. Para sair ou solicitar exclusão, use a área de conta.</p>
        <dl className={styles.identity}>
          <div><dt>E-mail</dt><dd>{session.email === null ? "não informado pelo provedor" : maskEmail(session.email)}</dd></div>
          <div><dt>Papel</dt><dd>{roleLabel(session.viewer.role)}</dd></div>
        </dl>
        <Link className={styles.login} href="/conta">Ir para conta</Link>
      </> : null}
      {session.state === "degraded" ? <>
        <h1 id="profile-title">Perfil indisponível agora.</h1>
        <p>Sua identidade foi confirmada, mas o registro de perfil não respondeu. Nenhum dado pessoal é exibido e nenhuma permissão é concedida enquanto isso.</p>
        <Link className={styles.login} href="/conta">Ir para conta</Link>
      </> : null}
      {session.state === "anonymous" ? <>
        <h1 id="profile-title">Sua área pessoal está protegida.</h1>
        <p>Não há sessão ativa neste navegador. Entre com o código enviado ao seu e-mail para acessar os dados da conta.</p>
        <Link className={styles.login} href="/entrar">Entrar</Link>
      </> : null}
      {session.state === "unconfigured" ? <>
        <h1 id="profile-title">Sua área pessoal ainda está protegida.</h1>
        <p>A identidade não está configurada neste ambiente. Entre quando a autenticação segura estiver disponível para acessar dados pessoais e sincronização.</p>
        <Link className={styles.login} href="/entrar">Ver acesso à conta</Link>
      </> : null}
    </section>

    <section className={styles.grid} aria-label="Recursos de perfil ainda não construídos">
      {pendingSections.map(([title, text]) => <article className={styles.card} key={title}>
        <span>NÃO DISPONÍVEL</span><h2>{title}</h2><p>{text}</p><button type="button" disabled aria-disabled="true">Indisponível</button>
      </article>)}
    </section>

    <p className={styles.footnote}>
      Esta página mostra apenas dados da sua própria conta e nunca os de outra pessoa. Sem sessão, nada é exibido.
    </p>
  </main>;
}
