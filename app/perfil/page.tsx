import Link from "next/link";
import styles from "./page.module.css";

export const metadata = { title: "Perfil | Bíblia Bereana", description: "Área pessoal da Bíblia Bereana, aguardando autenticação." };

const sections = [
  ["Identidade", "Seu nome e dados da conta aparecerão aqui somente depois de entrar com segurança."],
  ["Preferências sincronizadas", "Tema, fonte e espaçamento ainda ficam apenas na sessão atual do leitor."],
  ["Leituras e notas", "Notas, destaques e capítulos lidos não são vinculados a uma conta nesta etapa."],
  ["Dispositivos", "A lista de dispositivos estará disponível quando houver autenticação e sincronização."],
  ["Segurança e duas etapas", "A verificação em duas etapas depende da integração de autenticação pendente."],
] as const;

export default function ProfilePage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/">bíblia<span>•</span>bereana</Link>
      <Link className={styles.back} href="/biblia">← Bíblia</Link>
    </header>
    <section className={styles.intro} aria-labelledby="profile-title">
      <p className={styles.eyebrow}>PERFIL</p>
      <h1 id="profile-title">Sua área pessoal ainda está protegida.</h1>
      <p>Não há sessão ativa. Entre quando a autenticação segura estiver disponível para acessar dados pessoais e sincronização.</p>
      <Link className={styles.login} href="/entrar">Ver acesso à conta</Link>
    </section>
    <section className={styles.grid} aria-label="Recursos de perfil indisponíveis">
      {sections.map(([title, text]) => <article className={styles.card} key={title}>
        <span>REQUER AUTENTICAÇÃO</span><h2>{title}</h2><p>{text}</p><button type="button" disabled aria-disabled="true">Indisponível</button>
      </article>)}
    </section>
    <p className={styles.footnote}>Integração de autenticação pendente. Esta página não coleta, exibe ou persiste dados pessoais.</p>
  </main>;
}
