/** Teste local para o verbete BDB s.cy.aa (H7121), sem alteração no banco.
 * Traduções de trabalho: preservamos o original e exigimos revisão editorial.
 */
const qaraDefinitions: Readonly<Record<string, string>> = {
  call: "chamar",
  proclaim: "proclamar",
  read: "ler",
  cry: "clamar",
  "utter a loud sound": "emitir um som alto",
  "call unto": "chamar por",
  "read aloud": "ler em voz alta",
  summon: "convocar",
  name: "dar nome",
  "be called": "ser chamado",
};

const darknessDefinitions: Readonly<Record<string, string>> = {
  darkness: "trevas",
  obscurity: "escuridão",
  "secret place(s)": "lugar(es) oculto(s)",
  "hiding-place": "esconderijo",
};

const darknessNotes: Readonly<Record<string, string>> = {
  "fig.": "sentidos figurados",
  "= distress": "aflição",
  "= dread, terror, symbol. of judgment": "pavor, terror; símbolo de juízo",
  "= mourning": "luto",
  "= perplexity; confusion": "perplexidade; confusão",
  "= ignorance": "ignorância",
  "= evil, sin": "mal, pecado",
  "= obscurity": "obscuridade",
};

export function hasPilotEntry(strong: string, bdbId: string): boolean {
  return (strong === "H7121" && bdbId === "s.cy.aa") || (strong === "H2822" && bdbId === "h.gt.ab");
}

export function pilotWord(language: string | string[] | undefined, strong: string) {
  return language === "hbo" && strong === "H7121"
    ? { transliteration: "qârâʼ", pronunciation: "ca-RÁ" }
    : null;
}

export function pilotDefinition(strong: string, bdbId: string, original: string): string | null {
  if (!hasPilotEntry(strong, bdbId)) return null;
  const definitions = strong === "H7121" ? qaraDefinitions : darknessDefinitions;
  return definitions[original.trim().toLowerCase()] ?? null;
}

export function pilotSenseNote(strong: string, bdbId: string, note: string | null): string | null {
  if (strong !== "H2822" || bdbId !== "h.gt.ab" || note === null) return null;
  return darknessNotes[note.trim().toLowerCase()] ?? null;
}

/** Correspondência pontual conferida na Bíblia Livre; não generalizar por Strong. */
export function pilotContextualTranslation(book: string, chapter: number, verse: number, position: number, translationName: string, strongIds: readonly string[]): string | null {
  if (book !== "genesis" || chapter !== 1 || verse !== 5 || translationName !== "Bíblia Livre") return null;
  if ((position === 1 || position === 6) && strongIds.includes("H7121")) return "chamou";
  if (position === 5 && strongIds.includes("H2822")) return "trevas";
  return null;
}
