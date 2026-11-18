export type CatalogAccess = "free" | "pending";

export interface CatalogLesson {
  readonly id: string;
  readonly title: string;
  readonly reading: string;
}

export interface CatalogModule {
  readonly id: string;
  readonly title: string;
  readonly lessons: readonly CatalogLesson[];
}

export interface CatalogCourse {
  readonly id: string;
  readonly title: string;
  readonly theme: string;
  readonly summary: string;
  readonly access: CatalogAccess;
  readonly modules: readonly CatalogModule[];
}

function present(value: string): boolean {
  return value.trim().length > 0;
}

/** Reject incomplete editorial fixtures before they are used by a catalog UI. */
export function isValidCatalogCourse(course: CatalogCourse): boolean {
  if (![course.id, course.title, course.theme, course.summary].every(present)) return false;
  if (course.access !== "free" && course.access !== "pending") return false;
  if (course.modules.length === 0) return false;
  const moduleIds = new Set<string>();
  const lessonIds = new Set<string>();
  for (const courseModule of course.modules) {
    if (!present(courseModule.id) || !present(courseModule.title) || moduleIds.has(courseModule.id)) return false;
    moduleIds.add(courseModule.id);
    if (courseModule.lessons.length === 0) return false;
    for (const lesson of courseModule.lessons) {
      if (![lesson.id, lesson.title, lesson.reading].every(present) || lessonIds.has(lesson.id)) return false;
      lessonIds.add(lesson.id);
    }
  }
  return true;
}
