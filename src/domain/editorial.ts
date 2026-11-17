import type { Role, StudyStatus } from "./access";
const transitions: Record<StudyStatus, readonly StudyStatus[]> = {
  draft: ["in_review"], in_review: ["draft", "approved"], approved: ["draft", "published"], published: ["archived"], archived: [],
};
export interface EditorialTransitionContext {
  role: Role; authorId: string; reviewerId?: string; teamReviewRequired?: boolean;
  sourcesValid?: boolean; hasPublishableSection?: boolean;
}
export function transitionStudy(from: StudyStatus, to: StudyStatus, context: EditorialTransitionContext): StudyStatus {
  if (!transitions[from].includes(to)) throw new Error("Invalid editorial transition");
  if (context.role !== "editor" && context.role !== "admin") throw new Error("Editorial role required");
  if (!context.authorId.trim()) throw new Error("Author required");
  if ((to === "approved" || to === "published") && !context.reviewerId?.trim()) throw new Error("Reviewer required");
  if ((to === "approved" || to === "published") && context.teamReviewRequired && context.reviewerId === context.authorId) throw new Error("Independent reviewer required");
  if (to === "published" && (context.role !== "admin" || !context.sourcesValid || !context.hasPublishableSection)) throw new Error("Publication requirements not met");
  return to;
}
