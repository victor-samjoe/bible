import Link from "next/link";
import { materialFixtures } from "@/src/content/catalog-fixtures";

export const metadata = {
  title: "Materiais | Bíblia Bereana",
  description: "Catálogo editorial de materiais em preparação.",
};

export default function MaterialsPage() {
  return <>
    <nav className="nav" aria-label="Navegação principal">
      <Link className="brand" href="/">bíblia<span>•</span>bereana</Link>
      <Link href="/biblia">Bíblia</Link>
    </nav>
    <main className="page">
      <p className="eyebrow">CATÁLOGO EDITORIAL</p>
      <h1>Materiais para apoiar a leitura.</h1>
      <p className="muted">Estas são fichas editoriais locais. A publicação de conteúdo, fontes e direitos continua sujeita à revisão.</p>
      <section className="catalog" aria-label="Materiais editoriais">
        {materialFixtures.map((material) => <article key={material.id} className="study-card">
          <span className="tag">{material.access === "free" ? "LIVRE ·" : "EM PREPARAÇÃO ·"} {material.format.toUpperCase()}</span>
          <h2>{material.title}</h2>
          <p>{material.summary}</p>
          <p className="muted">Tema: {material.theme}</p>
        </article>)}
      </section>
    </main>
  </>;
}
