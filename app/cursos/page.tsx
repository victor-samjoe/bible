import Link from "next/link";
import { courseFixtures } from "@/src/content/catalog-fixtures";

export const metadata = {
  title: "Cursos | Bíblia Bereana",
  description: "Estruturas editoriais de cursos em preparação.",
};

export default function CoursesPage() {
  return <>
    <nav className="nav" aria-label="Navegação principal">
      <Link className="brand" href="/">bíblia<span>•</span>bereana</Link>
      <Link href="/materiais">Materiais</Link>
    </nav>
    <main className="page">
      <p className="eyebrow">CURSOS EM PREPARAÇÃO</p>
      <h1>Estruturas de aprendizado, sem progresso simulado.</h1>
      <p className="muted">Nenhuma aula, fonte, acesso premium ou progresso pessoal é liberado nesta etapa.</p>
      <section className="catalog" aria-label="Cursos editoriais">
        {courseFixtures.map((course) => <article key={course.id} className="study-card">
          <span className="tag">EM PREPARAÇÃO · {course.theme.toUpperCase()}</span>
          <h2>{course.title}</h2>
          <p>{course.summary}</p>
          {course.modules.map((module) => <section key={module.id} aria-label={module.title}>
            <h3>{module.title}</h3>
            <ul>
              {module.lessons.map((lesson) => <li key={lesson.id}><strong>{lesson.title}</strong> — {lesson.reading}</li>)}
            </ul>
          </section>)}
        </article>)}
      </section>
    </main>
  </>;
}
