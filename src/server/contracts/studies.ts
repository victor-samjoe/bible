import type { AccessLevel, StudyStatus } from "../../domain/access";
export interface StudyMetadata { id: string; slug: string; title: string; summary: string; access: AccessLevel; status: StudyStatus; publishedVersionId: string }
export interface StudySection { id: string; order: number; title: string; content: string; visibility: AccessLevel }
export interface PublicStudy { study: StudyMetadata; preview: boolean; sections: StudySection[] }
/** Repositories must query free sections only when includePremium is false. */
export interface StudyRepository {
  findPublishedBySlug(slug: string): Promise<StudyMetadata | null>;
  listPublished(): Promise<StudyMetadata[]>;
  listSections(versionId: string, includePremium: boolean): Promise<StudySection[]>;
}
/** Defense in depth: discard unexpected premium rows from an unprivileged query. */
export function projectStudy(study: StudyMetadata, sections: readonly StudySection[], authorized: boolean): PublicStudy {
  if (study.status !== "published") throw new Error("Study is not published");
  const allowed = authorized ? sections : sections.filter((section) => section.visibility === "free");
  const { id, slug, title, summary, access, status, publishedVersionId } = study;
  return { study: { id, slug, title, summary, access, status, publishedVersionId }, preview: access === "premium" && !authorized, sections: allowed.map(({ id, order, title, content, visibility }) => ({ id, order, title, content, visibility })) };
}

