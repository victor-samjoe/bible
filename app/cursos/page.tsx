import { courseFixtures } from "@/src/content/catalog-fixtures";

export const metadata = {
  title: "Cursos | Bíblia Bereana",
  description: "Estruturas editoriais de cursos em preparação.",
};

export default function CoursesPage() {
  return <main className="page">
      <p className="eyebrow">CURSOS EM PREPARAÇÃO</p>
      <h1>Cursos.</h1>
      <section className="catalog" aria-label="Cursos editoriais">
        {courseFixtures.map((course) => <article key={course.id} className="study-card">
          <span className="tag">EM PREPARAÇÃO · {course.theme.toUpperCase()}</span>
          <h2>{course.title}</h2>
          <p>{course.summary}</p>
        </article>)}
      </section>
    </main>;
}
