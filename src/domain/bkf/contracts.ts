import { z } from "zod";

export const BkfId = z.uuid();
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/i, "SHA-256 hexadecimal obrigatório");
export const IsoDateTime = z.iso.datetime();

export const RightsStatus = z.enum(["UNKNOWN", "RESTRICTED", "INTERNAL_REVIEW", "APPROVED_LIMITED", "APPROVED_FULL", "BLOCKED"]);
export const EditorialState = z.enum(["DRAFT", "RESEARCHED", "EVIDENCE_VERIFIED", "CRITICALLY_REVIEWED", "HUMAN_APPROVAL", "PUBLISHED", "NEEDS_SOURCES", "NEEDS_REVISION", "RIGHTS_BLOCKED", "REJECTED", "SUPERSEDED", "RETRACTED"]);

const WordLimits = z.object({ per_quote: z.number().int().nonnegative(), per_work: z.number().int().nonnegative(), per_document: z.number().int().nonnegative() }).strict();
const Permissions = z.object({ store: z.boolean(), automated_processing: z.boolean(), quote: z.boolean(), public_distribution: z.boolean() }).strict();
/**
 * Imagem não se cita por palavras: é usada inteira ou não é usada. Um ativo
 * visual (mapa, foto, arte) precisa destas permissões próprias; quando elas
 * faltam, `canDisplay`/`canDeriveWork` recusam por padrão.
 */
const VisualPermissions = z.object({ reproduce: z.boolean(), adapt: z.boolean(), commercial: z.boolean(), share_alike: z.boolean(), modification_notice: z.boolean() }).strict();

export const RightsSchema = z.object({
  id: BkfId, edition_id: BkfId, status: RightsStatus, permissions: Permissions,
  proof: z.string().min(1), verified_by: z.string().min(1), verified_at: IsoDateTime,
  valid_from: IsoDateTime, valid_until: IsoDateTime.optional(), territory: z.string().min(1),
  attribution: z.string().min(1), word_limits: WordLimits.optional(),
  visual_permissions: VisualPermissions.optional(),
}).strict();

export const EditionSchema = z.object({ id: BkfId, work_id: BkfId, title: z.string().min(1), language: z.string().min(2), edition_label: z.string().min(1), source_url: z.url(), rights_id: BkfId }).strict();
export const ManifestSchema = z.object({ id: BkfId, edition_id: BkfId, original_sha256: Sha256, extraction_version: z.string().min(1), normalized_sha256: Sha256, created_at: IsoDateTime }).strict();
export const FragmentSchema = z.object({ id: BkfId, manifest_id: BkfId, locator: z.string().min(1), start_offset: z.number().int().nonnegative(), end_offset: z.number().int().nonnegative(), text: z.string(), previous_text: z.string(), next_text: z.string() }).strict().superRefine((v, ctx) => { if (v.end_offset <= v.start_offset) ctx.addIssue({ code: "custom", message: "intervalo UTF-16 inválido", path: ["end_offset"] }); });
export const EvidenceSchema = z.object({ id: BkfId, fragment_id: BkfId, edition_id: BkfId, start_offset: z.number().int().nonnegative(), end_offset: z.number().int().nonnegative(), category: z.enum(["QUOTE", "PARAPHRASE", "FACT", "INFERENCE"]), verification_state: z.enum(["PENDING", "VERIFIED", "REJECTED"]), rights_id: BkfId }).strict().superRefine((v, ctx) => { if (v.end_offset <= v.start_offset) ctx.addIssue({ code: "custom", message: "faixa de evidência inválida", path: ["end_offset"] }); });
export const DossierSchema = z.object({ id: BkfId, question: z.string().min(1), scope: z.string().min(1), passages: z.array(z.string().min(1)), topics: z.array(z.string().min(1)), evidence_ids: z.array(BkfId), open_questions: z.array(z.string()), limitations: z.array(z.string()), version: z.string().min(1) }).strict();
export const ClaimSchema = z.object({ id: BkfId, kind: z.enum(["FACT", "PARAPHRASE", "INFERENCE", "SYNTHESIS"]), text: z.string().min(1), evidence_ids: z.array(BkfId), limitations: z.array(z.string()) }).strict();
export const DocumentSchema = z.object({ id: BkfId, dossier_id: BkfId, title: z.string().min(1), sections: z.array(z.object({ id: BkfId, title: z.string().min(1), content: z.string(), claim_ids: z.array(BkfId) }).strict()), claims: z.array(ClaimSchema), source_ids: z.array(BkfId), coverage: z.string().min(1), limitations: z.array(z.string()), state: EditorialState, version: z.string().min(1) }).strict();
export const ReviewSchema = z.object({ id: BkfId, document_id: BkfId, reviewer_id: BkfId, independent: z.boolean(), decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]), notes: z.string(), created_at: IsoDateTime }).strict();
export const JobSchema = z.object({ id: BkfId, stage: z.enum(["INGEST", "INDEX", "RESEARCH", "ANALYSIS", "REVIEW", "PUBLISH"]), state: z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "BLOCKED"]), input_version: z.string().min(1), created_at: IsoDateTime, updated_at: IsoDateTime }).strict();

export type Rights = z.infer<typeof RightsSchema>;
export type VisualPermissions = z.infer<typeof VisualPermissions>;
export type EditorialState = z.infer<typeof EditorialState>;
