import {
  sanitizeReaderPreferences,
  sanitizeReaderTheme,
  type ReaderPreferences,
  type ReaderTheme,
} from "../../domain/reader-preferences";
import { parseChapterMarksPayload, type ChapterMarksPayload } from "../../domain/reading-sync";
import { getViewer } from "../auth/runtime";
import { getDatabaseAsync } from "../db/client";
import { createDrizzlePersonalReadingRepository, type PersonalMarks } from "./personal";

/**
 * Entrada autenticada dos dados pessoais de leitura.
 *
 * Duas responsabilidades, e nenhuma outra:
 *
 *  1. **Quem é a pessoa.** O `userId` sai de `getViewer()`, que confere a
 *     sessão no provedor e o papel no banco. Nenhuma função daqui aceita
 *     `userId` como argumento — se aceitasse, bastaria um campo escondido no
 *     formulário para ler a nota de outra pessoa.
 *  2. **O que o navegador mandou é suspeito.** Tudo passa por validação antes
 *     de virar escrita. Marca inválida é descartada em silêncio, e não derruba
 *     a gravação inteira: quem está lendo não deve perder uma nota boa porque
 *     outra veio torta.
 *
 * Nada aqui lança para o chamador. Banco fora do ar, sessão ausente ou dado
 * inválido devolvem `false`/`null`, e o leitor continua funcionando em memória.
 */

export type AccountReadingState = {
  readonly theme: ReaderTheme | null;
  readonly preferences: ReaderPreferences | null;
  readonly marks: PersonalMarks;
};

async function repository() {
  const database = await getDatabaseAsync();
  return database === null ? null : createDrizzlePersonalReadingRepository(database);
}

/** Estado da conta, ou `null` quando não há sessão ou banco. */
export async function loadAccountReading(): Promise<AccountReadingState | null> {
  const viewer = await getViewer();
  if (viewer === null) return null;
  const repo = await repository();
  if (repo === null) return null;
  try {
    const [stored, marks] = await Promise.all([repo.findPreferences(viewer.id), repo.loadMarks(viewer.id)]);
    return {
      theme: stored === null ? null : sanitizeReaderTheme(stored.theme),
      preferences:
        stored === null
          ? null
          : sanitizeReaderPreferences({
              fontFamily: stored.fontFamily,
              fontSize: stored.fontSize,
              spacing: stored.lineSpacing,
              paragraphSpacing: stored.paragraphSpacing,
            }),
      marks,
    };
  } catch {
    return null;
  }
}

export async function saveAccountPreferences(theme: unknown, preferences: unknown): Promise<boolean> {
  const viewer = await getViewer();
  if (viewer === null) return false;
  const repo = await repository();
  if (repo === null) return false;
  const safe = sanitizeReaderPreferences(preferences);
  try {
    await repo.savePreferences(viewer.id, {
      theme: sanitizeReaderTheme(theme),
      fontFamily: safe.fontFamily,
      fontSize: safe.fontSize,
      lineSpacing: safe.spacing,
      paragraphSpacing: safe.paragraphSpacing,
    });
    return true;
  } catch {
    return false;
  }
}

export async function saveAccountChapterMarks(payload: ChapterMarksPayload): Promise<boolean> {
  const viewer = await getViewer();
  if (viewer === null) return false;
  const parsed = parseChapterMarksPayload(payload);
  if (parsed === null) return false;
  const repo = await repository();
  if (repo === null) return false;
  try {
    return await repo.replaceChapterMarks(viewer.id, parsed.bookSlug, parsed.chapterNumber, parsed.marks);
  } catch {
    return false;
  }
}
