import Link from "next/link";
import { roleLabel } from "@/src/domain/account-access";
import { authorize } from "@/src/server/auth";
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
const roles = [
  ["reader", "Leitor", "Leitura, notas, destaques e preferências da própria conta. É o papel de toda conta nova."],
  ["editor", "Editor", "Acesso ao fluxo editorial, sempre sujeito a revisão e a verificação de permissão no servidor."],
  ["admin", "Administrador", "Gestão de papéis e controles de segurança. Concedido fora da aplicação, por operação administrativa."],
] as const;

export default async function AccessControlPage() {
  const session = await getAccountSession();
  const viewer = session.state === "authenticated" ? session.viewer : null;
  // Mesmo com sessão, administrar papéis exigiria `admin`: a verificação fica
  // registrada aqui para a tela não sugerir uma permissão que ninguém tem.
  const administrates = authorize(viewer, "admin").ok;

  return <main className="page" aria-labelledby="access-title">
    <p className="eyebrow">CONTROLE DE ACESSO</p>
    <h1 id="access-title">Papéis verificados no servidor.</h1>
    <p className="muted">
      Permissão é decidida no servidor a cada requisição, lendo o papel da tabela de perfis. Nada do que o
      navegador envia — cookie, formulário ou cabeçalho — concede acesso.
    </p>

    <section className="notice" aria-label="Seu papel">
      {viewer === null
        ? <><strong>Sem sessão nesta visita.</strong><br />Nenhum papel é atribuído a visitantes, e nenhum dado pessoal é acessível sem conta.</>
        : <><strong>Seu papel: {roleLabel(viewer.role)}.</strong><br />{administrates
            ? "A atribuição de papéis a outras pessoas ainda não existe na aplicação: ela depende de trilha de auditoria, que não foi construída."
            : "Alterar o próprio papel não é possível, por construção: o banco recusa a mudança vinda da aplicação."}</>}
    </section>

    <section className="catalog" aria-label="Papéis disponíveis">
      {roles.map(([id, label, description]) => <article className="study-card" key={id}>
        <span className="tag">{viewer?.role === id ? "SEU PAPEL" : "DEFINIDO NO SERVIDOR"}</span>
        <h2>{label}</h2>
        <p>{description}</p>
      </article>)}
    </section>

    <p>
      {viewer === null
        ? <Link className="text-link" href="/entrar">Entrar na conta</Link>
        : <Link className="text-link" href="/conta">Ir para conta</Link>}
    </p>
  </main>;
}
