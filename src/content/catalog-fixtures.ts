import type { CatalogAccess, CatalogCourse, CatalogLesson, CatalogModule } from "@/src/domain/catalog";

export type { CatalogAccess } from "@/src/domain/catalog";

export interface MaterialFixture {
  readonly id: string;
  readonly title: string;
  readonly format: "Guia de leitura" | "Roteiro" | "Bibliografia";
  readonly summary: string;
  readonly theme: string;
  readonly access: CatalogAccess;
}

export type CourseLessonFixture = CatalogLesson;
export type CourseModuleFixture = CatalogModule;
export type CourseFixture = CatalogCourse;

/**
 * Placeholders editoriais deliberados: não representam aulas ou obras publicadas,
 * nem progresso de uma pessoa. Entradas reais deverão vir do fluxo editorial.
 */
export const materialFixtures: readonly MaterialFixture[] = [
  {
    id: "como-ler-contexto",
    title: "Como ler um texto em seu contexto",
    format: "Guia de leitura",
    summary: "Estrutura editorial de um guia sobre observação, contexto literário e perguntas de leitura.",
    theme: "Método de leitura",
    access: "free",
  },
  {
    id: "roteiro-romanos",
    title: "Roteiro de observação em Romanos",
    format: "Roteiro",
    summary: "Modelo de roteiro em preparação; não contém comentário, respostas ou material de curso publicado.",
    theme: "Cartas paulinas",
    access: "pending",
  },
  {
    id: "bibliografia-historia",
    title: "Bibliografia para história da interpretação",
    format: "Bibliografia",
    summary: "Ficha editorial para futura curadoria de referências verificadas por edição e direitos.",
    theme: "História da interpretação",
    access: "pending",
  },
];

export const courseFixtures: readonly CourseFixture[] = [
  {
    id: "leitura-responsavel",
    title: "Leitura bíblica responsável",
    theme: "Método de leitura",
    summary: "Estrutura de curso editorial em preparação; módulos e leituras abaixo não registram progresso pessoal.",
    access: "pending",
    modules: [
      {
        id: "observar",
        title: "Módulo 1 · Observar o texto",
        lessons: [
          { id: "delimitacao", title: "Delimitar a passagem", reading: "Leitura a definir pela edição aprovada" },
          { id: "repeticoes", title: "Notar repetições e conexões", reading: "Leitura a definir pela edição aprovada" },
        ],
      },
      {
        id: "contextualizar",
        title: "Módulo 2 · Situar a passagem",
        lessons: [
          { id: "literario", title: "Contexto literário", reading: "Leitura a definir pela edição aprovada" },
          { id: "historico", title: "Contexto histórico", reading: "Fontes ainda não selecionadas" },
        ],
      },
    ],
  },
];
