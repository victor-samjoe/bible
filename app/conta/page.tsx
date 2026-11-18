import Link from "next/link";
import { maskEmail, roleLabel } from "@/src/domain/account-access";
import { getAccountSession } from "@/src/server/auth/runtime";
import { requestDeletionAction, signOutAction } from "../_actions/account-access";
import styles from "./page.module.css";

export const metadata = {
  title: "Conta | Bíblia Bereana",
  description: "Área de conta da Bíblia Bereana: sessão, dados mínimos, sair e solicitar exclusão.",
};

export const dynamic = "force-dynamic";

/**
 * Conta (frente A do plano de contas).
 *
 * Quatro estados, todos honestos:
 *
 *  - `unconfigured`: identidade não configurada no ambiente. A página diz isso e
 *    não oferece ação alguma. É o estado do projeto enquanto as chaves do
 *    Supabase não estiverem preenchidas.
 *  - `anonymous`: sem sessão. Oferece o caminho para entrar e nada mais.
 *  - `degraded`: identidade confirmada no provedor, mas a tabela confiável de
 *    papel não respondeu. Sem papel não há autorização, então a página explica
 *    em vez de assumir "leitor" — assumir seria conceder acesso sem fonte.
 *  - `authenticated`: mostra só o que é da própria pessoa, e sempre o mínimo:
 *    e-mail mascarado, papel, data de criação e as duas ações previstas no
 *    plano, sair e solicitar exclusão.
 *
 * Nenhum dado de outra pessoa é lido aqui, e nada é escrito fora das duas Server
 * Actions, que confirmam a identidade no servidor antes de agir.
 */
const accountSteps = [
  {
    title: "Entrar",
    text: "Acesse suas notas, leituras e preferências quando a autenticação estiver liberada.",
  },
  {
    title: "Criar conta",
    text: "Crie uma conta para sincronizar sua biblioteca entre dispositivos.",
  },
  {
    title: "Recuperar acesso",
    text: "Receba um código de uso único no e-mail da conta.",
  },
  {
    title: "Verificação em duas etapas",
    text: "Adicione uma segunda camada de proteção à sua conta.",
  },
];

function formatDate(value: Date): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(value);
  } catch {
    return "data indisponível";
  }
}

export default async function ContaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getAccountSession();
  const deletion = (await searchParams).exclusao;

  return (
    <main className={styles.page}>
      {deletion === "solicitada" ? (
        <p className={styles.alert} role="status">
          <strong>Pedido de exclusão registrado.</strong> Sua sessão foi encerrada em todos os dispositivos. A
          remoção dos dados é executada conforme a política de retenção publicada; para acompanhar, use o canal
          de <Link className={styles.inlineLink} href="/contato">contato</Link>.
        </p>
      ) : null}
      {deletion === "indisponivel" ? (
        <p className={styles.alert} role="status">
          <strong>Não foi possível registrar o pedido agora.</strong> Nada foi alterado na sua conta. Tente de
          novo em alguns minutos ou use o canal de{" "}
          <Link className={styles.inlineLink} href="/contato">contato</Link>.
        </p>
      ) : null}

      {session.state === "authenticated" ? (
        <>
          <section className={styles.hero} aria-labelledby="conta-title">
            <p className={styles.eyebrow}>SUA CONTA</p>
            <h1 id="conta-title">Sessão ativa</h1>
            <p>
              Estes são todos os dados que a conta guarda sobre você. Notas, destaques e progresso ficam
              vinculados a esta conta e são acessíveis somente por ela.
            </p>
          </section>

          <section className={styles.data} aria-label="Dados da conta">
            <dl className={styles.list}>
              <div>
                <dt>E-mail</dt>
                <dd>{session.email === null ? "não informado pelo provedor" : maskEmail(session.email)}</dd>
              </div>
              <div>
                <dt>Papel</dt>
                <dd>{roleLabel(session.viewer.role)}</dd>
              </div>
              <div>
                <dt>Conta criada em</dt>
                <dd>{formatDate(session.profile.createdAt)}</dd>
              </div>
            </dl>
            <p className={styles.note}>
              Não guardamos senha: o acesso é sempre por código de uso único enviado ao e-mail acima.
            </p>
          </section>

          <section className={styles.plan} aria-labelledby="sessao-title">
            <div>
              <p className={styles.eyebrow}>SESSÃO</p>
              <h2 id="sessao-title">Sair desta conta</h2>
              <p>Encerra a sessão em todos os dispositivos conectados a esta conta.</p>
            </div>
            <form action={signOutAction}>
              <button className={styles.action} type="submit">Sair</button>
            </form>
          </section>

          <section className={styles.plan} aria-labelledby="exclusao-title" id="exclusao">
            <div>
              <p className={styles.eyebrow}>EXCLUSÃO</p>
              <h2 id="exclusao-title">Solicitar exclusão da conta</h2>
              <p>
                {session.deletionRequested
                  ? "Já existe um pedido de exclusão aberto para esta conta. Ele será processado conforme a política de retenção publicada."
                  : "Registra o pedido e encerra sua sessão imediatamente. A remoção dos dados é executada conforme a política de retenção publicada, não neste clique."}
              </p>
            </div>
            {session.deletionRequested ? (
              <p className={styles.pending}>PEDIDO ABERTO</p>
            ) : (
              <form action={requestDeletionAction}>
                <button className={styles.danger} type="submit">Solicitar exclusão</button>
              </form>
            )}
          </section>

          <section className={styles.recovery} aria-labelledby="recuperacao-title" id="recuperacao">
            <h2 id="recuperacao-title">Perdi o acesso ao e-mail</h2>
            <p>
              Como não existe senha, o acesso depende do e-mail da conta. Sem acesso a ele, não há como provar
              a identidade por aqui: use o canal de{" "}
              <Link className={styles.inlineLink} href="/contato">contato</Link> para tratar o caso.
            </p>
          </section>
        </>
      ) : null}

      {session.state === "degraded" ? (
        <>
          <section className={styles.hero} aria-labelledby="conta-title">
            <p className={styles.eyebrow}>SUA CONTA</p>
            <h1 id="conta-title">Conta temporariamente indisponível</h1>
            <p>
              Sua identidade foi confirmada, mas o registro de perfil não respondeu agora. Por segurança,
              nenhum dado pessoal é exibido e nenhuma permissão é concedida enquanto isso. Tente novamente em
              alguns minutos.
            </p>
          </section>
          <section className={styles.plan} aria-label="Encerrar sessão">
            <div>
              <p className={styles.eyebrow}>SESSÃO</p>
              <h2>Sair desta conta</h2>
              <p>Você pode encerrar a sessão mesmo com o perfil indisponível.</p>
            </div>
            <form action={signOutAction}>
              <button className={styles.action} type="submit">Sair</button>
            </form>
          </section>
        </>
      ) : null}

      {session.state === "anonymous" ? (
        <>
          <section className={styles.hero} aria-labelledby="conta-title">
            <p className={styles.eyebrow}>SUA ÁREA</p>
            <h1 id="conta-title">Entre para ver sua conta</h1>
            <p>
              Não há sessão ativa neste navegador. O acesso é por código de uso único enviado ao seu e-mail, sem
              senha. Os recursos de leitura continuam disponíveis sem conta.
            </p>
            <Link className={styles.login} href="/entrar">Entrar</Link>
          </section>
          <section className={styles.recovery} aria-labelledby="recuperacao-title" id="recuperacao">
            <h2 id="recuperacao-title">Recuperar acesso</h2>
            <p>
              Não existe senha para recuperar. Peça um novo código em{" "}
              <Link className={styles.inlineLink} href="/entrar">entrar</Link>; se você perdeu o acesso ao
              e-mail da conta, use o canal de{" "}
              <Link className={styles.inlineLink} href="/contato">contato</Link>.
            </p>
          </section>
        </>
      ) : null}

      {session.state === "unconfigured" ? (
        <>
          <section className={styles.hero} aria-labelledby="conta-title">
            <p className={styles.eyebrow}>SUA ÁREA</p>
            <h1 id="conta-title">Conta e leituras</h1>
            <p>
              Estamos preparando o acesso seguro para que suas notas, destaques e progresso acompanhem você.
              Enquanto isso, os recursos de leitura continuam disponíveis sem conta.
            </p>
          </section>

          <section className={styles.grid} aria-label="Recursos de conta em preparação">
            {accountSteps.map((item) => (
              <article key={item.title} className={styles.card}>
                <span className={styles.status}>EM PREPARAÇÃO</span>
                <h2>{item.title}</h2>
                <p>{item.text}</p>
                <button type="button" disabled aria-disabled="true">Em breve</button>
              </article>
            ))}
          </section>

          <p className={styles.note}>
            Nenhum login é solicitado nesta etapa e nenhum dado de conta é coletado por esta página.
          </p>
        </>
      ) : null}

      <section className={styles.plan} aria-labelledby="plan-title">
        <div>
          <p className={styles.eyebrow}>PLANOS</p>
          <h2 id="plan-title">Plano gratuito primeiro.</h2>
          <p>Planos pagos e checkout só aparecerão depois de a conta e a sincronização estarem prontas.</p>
        </div>
        <button type="button" disabled aria-disabled="true">Ver planos em breve</button>
      </section>
    </main>
  );
}
