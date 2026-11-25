// Declarações para o recorte de Gênesis 1, que é `.mjs` porque é executado
// direto por `node` sem o flag de strip-types. Só o que os testes importam.
export const SCOPE: { readonly bookCode: string; readonly chapter: number };

export function inScope(canonicalRef: string): boolean;

export function isAugmentedStrongKey(lexemeKey: string): boolean;

export function glossSubject(language: string, glossText: string): string;

export function ndjson(
  filePath: string,
): AsyncGenerator<[record: Record<string, unknown>, line: string, lineNumber: number]>;

export function selectionFor(reachable: {
  readonly lexemeKeys: ReadonlySet<string>;
  readonly bdbIds: ReadonlySet<string>;
}): (record: Record<string, unknown>) => boolean;

export function validateSlice(slice: {
  readonly occurrences: number;
  readonly lexemeKeys: ReadonlySet<string>;
  readonly entryKeys: ReadonlySet<string>;
  readonly bdbIds: ReadonlySet<string>;
  readonly linkPairs: readonly (readonly [string, string])[];
  readonly subjects: ReadonlySet<string>;
  readonly translationSubjects: readonly string[];
}): readonly string[];
