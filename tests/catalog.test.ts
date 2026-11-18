import { describe, expect, it } from "vitest";
import { courseFixtures } from "../src/content/catalog-fixtures";
import { isValidCatalogCourse } from "../src/domain/catalog";

describe("catalog editorial fixtures", () => {
  it("keeps every course fixture structurally complete", () => {
    expect(courseFixtures.length).toBeGreaterThan(0);
    expect(courseFixtures.every(isValidCatalogCourse)).toBe(true);
  });

  it("rejects duplicate or incomplete editorial entries", () => {
    expect(isValidCatalogCourse({
      id: "curso", title: "Curso", theme: "Tema", summary: "Resumo", access: "pending",
      modules: [{
        id: "modulo", title: "Módulo", lessons: [
          { id: "aula", title: "Aula", reading: "Leitura" },
          { id: "aula", title: "Outra aula", reading: "Leitura" },
        ],
      }],
    })).toBe(false);
    expect(isValidCatalogCourse({
      id: "curso", title: "Curso", theme: "Tema", summary: "Resumo", access: "pending", modules: [],
    })).toBe(false);
  });
});
