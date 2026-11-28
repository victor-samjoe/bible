import { OFFLINE_MANIFEST_PATH, verifyBookFile, verifyManifest, type OfflineManifest } from "../../domain/offline/package";
import { sanitizeUsfm } from "../contracts/bible";

/** Leitura pública por referência canônica. Não inventa UUIDs nem acessa dados pessoais. */
export type StaticChapter = {
  readonly book: { readonly code: string; readonly slug: string; readonly name: string };
  readonly chapter: number;
  readonly verses: readonly { readonly number: number; readonly content: string }[];
  readonly version: string;
  readonly attribution: string;
};
export type StaticChapterResult =
  | { readonly ok: true; readonly chapter: StaticChapter }
  | { readonly ok: false; readonly reason: "invalid_reference" | "not_found" | "unavailable" };

/** A porta deve apontar ao binding ASSETS do Worker; testes podem injetar outra origem. */
export function createStaticCloudflareReader(readAsset: (path: string) => Promise<Response>) {
  let manifestPromise: Promise<OfflineManifest> | null = null;
  const books = new Map<string, Promise<readonly (readonly string[])[]>>();
  async function manifest(): Promise<OfflineManifest> {
    if (!manifestPromise) manifestPromise = (async () => {
      const response = await readAsset(OFFLINE_MANIFEST_PATH);
      if (!response.ok) throw new Error("manifesto indisponível");
      const result = verifyManifest(await response.json());
      if (!result.ok) throw new Error("manifesto inválido");
      return result.manifest;
    })().catch((error) => { manifestPromise = null; throw error; });
    return manifestPromise;
  }
  return {
    async readChapter(slug: string, number: number): Promise<StaticChapterResult> {
      if (!/^[a-z0-9-]{1,64}$/u.test(slug) || !Number.isSafeInteger(number) || number < 1 || number > 150) return { ok: false, reason: "invalid_reference" };
      try {
        const index = await manifest();
        const entry = index.files.find((item) => item.slug === slug);
        if (!entry || number > entry.chapters) return { ok: false, reason: "not_found" };
        let pending = books.get(entry.book);
        if (!pending) {
          pending = (async () => {
            const response = await readAsset(entry.path);
            if (!response.ok) throw new Error("livro indisponível");
            const bytes = await response.arrayBuffer();
            if (bytes.byteLength !== entry.bytes) throw new Error("tamanho incompatível");
            const digest = await crypto.subtle.digest("SHA-256", bytes);
            const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
            const result = verifyBookFile(entry, index.version, bytes.byteLength, hash, JSON.parse(new TextDecoder().decode(bytes)));
            if (!result.ok) throw new Error("livro inválido");
            return result.file.chapters;
          })().catch((error) => { books.delete(entry.book); throw error; });
          books.set(entry.book, pending);
        }
        const contents = (await pending)[number - 1];
        if (!contents) return { ok: false, reason: "not_found" };
        const verses = contents.map((content, index) => ({ number: index + 1, content: sanitizeUsfm(content) }));
        if (verses.some((verse) => !verse.content)) return { ok: false, reason: "unavailable" };
        return { ok: true, chapter: { book: { code: entry.book, slug: entry.slug, name: entry.name }, chapter: number,
          verses, version: index.version, attribution: index.edition.attribution } };
      } catch { return { ok: false, reason: "unavailable" }; }
    },
  };
}
