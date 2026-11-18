import { courseFixtures } from "@/src/content/catalog-fixtures";

export const metadata = {
  title: "Cursos | Bíblia Bereana",
  description: "Estruturas editoriais de cursos em preparação.",
};

export default function CoursesPage() {
  return <main className="page">
      <p className="eyebrow">CURSOS EM PREPARAÇÃO</p>
      <h1>Cursos em construção.</h1>
      <p className="muted">Os conteúdos ainda passam por revisão editorial.</p>
      <section className="catalog" aria-label="Cursos editoriais">
        {courseFixtures.map((course) => <article key={course.id} className="study-card">
          <span className="tag">EM PREPARAÇÃO · {course.theme.toUpperCase()}</span>
          <h2>{course.title}</h2>
          <p>{course.summary}</p>
          <p className="muted">Estrutura e aulas serão exibidas quando o curso for publicado.</p>
        </article>)}
      </section>
    </main>;
}
