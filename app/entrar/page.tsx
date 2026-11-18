import Link from "next/link";
import styles from "./page.module.css";

export const metadata = { title: "Entrar | Bíblia Bereana", description: "Acesso à conta da Bíblia Bereana, em preparação." };

export default function LoginPage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link className={styles.brand} href="/">bíblia<span>•</span>bereana</Link>
      <Link className={styles.back} href="/biblia">← Voltar à Bíblia</Link>
    </header>
    <section className={styles.content} aria-labelledby="login-title">
      <p className={styles.eyebrow}>ÁREA PESSOAL</p>
      <h1 id="login-title">Entre quando a conta estiver pronta.</h1>
      <p className={styles.lede}>Estamos preparando um acesso seguro para sincronizar preferências, notas e leituras entre dispositivos.</p>
      <div className={styles.notice} role="status" id="integracao-pendente">
        <strong>Integração de autenticação pendente.</strong> Nenhum e-mail, senha ou código é solicitado ou enviado nesta etapa.
      </div>
      <form className={styles.form} aria-describedby="integracao-pendente">
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="Disponível quando o acesso for ativado" disabled />
        <button type="button" disabled aria-disabled="true">Receber link de acesso</button>
        <p>O acesso por link seguro ou código de uso único será oferecido depois da integração.</p>
      </form>
      <nav className={styles.links} aria-label="Opções de conta">
        <Link href="/criar-conta">Criar conta quando disponível</Link>
        <Link href="/conta#recuperacao">Recuperar acesso quando disponível</Link>
      </nav>
    </section>
  </main>;
}
