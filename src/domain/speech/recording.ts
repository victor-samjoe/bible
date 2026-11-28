/** Uma gravação só pode ser associada ao texto exato da edição usada para gerá-la. */
export type ChapterRecording = {
  readonly label: string;
  readonly source: string;
  readonly textSha256: string;
  readonly verseCount: number;
};

export function recordingText(verses: readonly { readonly number: number; readonly content: string }[]): string | null {
  if (!verses.length) return null;
  const sorted = [...verses].sort((a, b) => a.number - b.number);
  if (sorted.some((verse, index) => verse.number !== index + 1 || !verse.content.trim() || verse.content.includes("\\"))) return null;
  return sorted.map((verse) => verse.content.replace(/\s+/gu, " ").trim()).join(" ");
}

/** Restringe a futura entrega a uma rota autenticada, sem expor arquivo público. */
export function isPrivateRecordingSource(source: string): boolean {
  return /^\/api\/private-audio\/[a-z0-9][a-z0-9/-]*\.mp3$/u.test(source) && !source.includes("..");
}
