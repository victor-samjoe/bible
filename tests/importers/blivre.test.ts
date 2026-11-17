import { describe, expect, it } from "vitest";
import { convertCorpus, parseBook } from "../../src/importers/blivre";

const translation = "00000000-0000-4000-8000-000000000001";
const sample = "\\id GEN Exemplo\n\\toc2 Gênesis\n\\c 1\n\\p\n\\v 1 No princípio \\add Deus\\add* falou. \\f + \\fr 1:1 \\ft Nota. \\f*\n\\v 2 Fim.\n";
describe("BLIVRE USFM", () => {
  it("preserva marcas e notas, relaciona registros e mantém versos não publicados", () => {
    const result = parseBook(sample, "GEN", 1, translation);
    expect(result.book).toMatchObject({ code: "GEN", name: "Gênesis", slug: "genesis", translation_id: translation });
    expect(result.chapters[0].book_id).toBe(result.book.id);
    expect(result.verses[0]).toMatchObject({ chapter_id: result.chapters[0].id, published: false, content: "No princípio \\add Deus\\add* falou. \\f + \\fr 1:1 \\ft Nota. \\f*" });
  });
  it("rejeita versos duplicados, intervalos e códigos divergentes", () => {
    expect(() => parseBook(sample.replace("\\v 2", "\\v 1"), "GEN", 1, translation)).toThrow();
    expect(() => parseBook(sample.replace("\\v 2", "\\v 2-3"), "GEN", 1, translation)).toThrow();
    expect(() => parseBook(sample, "EXO", 1, translation)).toThrow();
  });
  it("valida e converte o corpus local completo", async () => {
    const result = await convertCorpus("data/source/porbr2018_usfm", translation);
    expect(result.books).toHaveLength(66);
    expect(result.chapters).toHaveLength(1189);
    expect(result.verses).toHaveLength(31102);
    expect(result.source.files).toHaveLength(66);
    expect(result.source.archiveChecksumVerified).toBe(false);
  });
});
