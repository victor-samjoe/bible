import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Conta | Bíblia Bereana",
  description: "Área de conta da Bíblia Bereana.",
};

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
    title: "Recuperar senha",
    text: "Receba um link seguro para definir uma nova senha.",
  },
  {
    title: "Verificação em duas etapas",
    text: "Adicione uma segunda camada de proteção à sua conta.",
  },
];

export default function ContaPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/biblia" className={styles.back}>← Bíblia</Link>
        <span className={styles.brand}>BÍBLIA BEREANA</span>
      </header>

      <section className={styles.hero} aria-labelledby="conta-title">
        <p className={styles.eyebrow}>SUA ÁREA</p>
        <h1 id="conta-title">Conta e leituras</h1>
        <p>
          Estamos preparando o acesso seguro para que suas notas, destaques e progresso acompanhem
          você. Enquanto isso, os recursos de leitura continuam disponíveis sem conta.
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

      <section className={styles.plan} aria-labelledby="plan-title">
        <div>
          <p className={styles.eyebrow}>PLANOS</p>
          <h2 id="plan-title">Plano gratuito primeiro.</h2>
          <p>Planos pagos e checkout só aparecerão depois de a conta e a sincronização estarem prontas.</p>
        </div>
        <button type="button" disabled aria-disabled="true">Ver planos em breve</button>
      </section>

      <p className={styles.note}>
        Nenhum login é solicitado nesta etapa e nenhum dado de conta é coletado por esta página.
      </p>
    </main>
  );
}
