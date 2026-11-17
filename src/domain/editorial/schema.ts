import { z } from "zod";

const text = z.string().trim().min(1);
const id = z.string().uuid();

export const SourceSchema = z.object({
  id, work: text, author: text, publisher: text, edition: text,
  year: z.number().int().positive(), identifier: text,
  license: text, rights_verified: z.boolean(), reliability: text,
  locations: z.array(z.object({ id, locator: text, permission: text }).strict()),
}).strict();

export const ClaimSchema = z.object({
  id, anchor: text, source_id: id, location_id: id,
  kind: z.enum(["quote", "paraphrase", "editorial_synthesis"]),
  verification_note: text, synthesis_notice: z.string(),
}).strict();

export const DossierSchema = z.object({
  schema_version: z.literal(1), draft_id: id,
  question: z.string(), scope: z.string(), passages: z.array(text), topics: z.array(text),
  sources: z.array(SourceSchema), claims: z.array(ClaimSchema),
  open_questions: z.array(text), rights_status: z.enum(["pending", "approved", "rejected"]),
  editorial_risks: z.array(text), token_budget_used: z.number().int().nonnegative(),
}).strict();

export const StudySchema = z.object({
  id, version_id: id, status: z.enum(["draft", "in_review", "approved", "published", "archived"]),
  title: text, summary: z.string(), type: text, level: z.string(), author: z.string(),
  reviewer: z.string(), team_review: z.boolean(), changelog: z.string(),
  sections: z.array(z.object({ id, title: text, content: z.string(), visibility: z.enum(["free", "premium"]), claim_ids: z.array(id) }).strict()),
  dossier: DossierSchema,
}).strict().refine((study) => study.id === study.dossier.draft_id, { message: "O dossiê deve pertencer ao estudo", path: ["dossier", "draft_id"] });

export type Study = z.infer<typeof StudySchema>;
export type Dossier = z.infer<typeof DossierSchema>;
