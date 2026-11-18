import { materialFixtures } from "@/src/content/catalog-fixtures";

export const metadata = {
  title: "Materiais | Bíblia Bereana",
  description: "Catálogo editorial de materiais em preparação.",
};

export default function MaterialsPage() {
  return <main className="page">
      <p className="eyebrow">CATÁLOGO EDITORIAL</p>
      <h1>Materiais.</h1>
      <section className="catalog" aria-label="Materiais editoriais">
        {materialFixtures.map((material) => <article key={material.id} className="study-card">
          <span className="tag">{material.access === "free" ? "LIVRE ·" : "EM PREPARAÇÃO ·"} {material.format.toUpperCase()}</span>
          <h2>{material.title}</h2>
          <p>{material.summary}</p>
        </article>)}
      </section>
    </main>;
}
