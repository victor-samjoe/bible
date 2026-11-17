import { z } from "zod";

const sha256 = z.string().regex(/^[a-f0-9]{64}$/i, "SHA-256 hexadecimal esperado").transform((value) => value.toLowerCase());
const isoDate = z.string().datetime({ offset: true });

export const TheologyImportManifestSchema = z.object({
  schema_version: z.literal(1),
  edition_id: z.uuid(),
  work: z.object({
    title: z.string().trim().min(1).max(500),
    authors: z.array(z.string().trim().min(1).max(200)).min(1).max(25),
    language: z.string().trim().min(2).max(32),
    edition_label: z.string().trim().min(1).max(500),
    is_translation: z.boolean(),
    translator: z.string().trim().min(1).max(200).nullable(),
  }).strict(),
  provenance: z.object({
    source_url: z.url(),
    retrieved_at: isoDate,
    original_filename: z.string().trim().min(1).max(255).regex(/^[^\\/]+$/, "Nome de arquivo não pode conter caminhos"),
    sha256: sha256,
  }).strict(),
  rights: z.object({
    status: z.enum(["APPROVED_LIMITED", "APPROVED_FULL"]),
    store: z.literal(true),
    automated_processing: z.literal(true),
    quote: z.boolean(),
    public_distribution: z.boolean(),
    evidence_url: z.url(),
    verified_by: z.string().trim().min(1).max(200),
    verified_at: isoDate,
    expires_at: isoDate.nullable(),
    attribution: z.string().trim().min(1).max(2000),
  }).strict(),
}).strict().superRefine((manifest, context) => {
  if (manifest.work.is_translation && manifest.work.translator === null) {
    context.addIssue({ code: "custom", path: ["work", "translator"], message: "Traduções exigem tradutor identificado." });
  }
  if (!manifest.work.is_translation && manifest.work.translator !== null) {
    context.addIssue({ code: "custom", path: ["work", "translator"], message: "Texto não traduzido não deve declarar tradutor." });
  }
  if (manifest.rights.expires_at && Date.parse(manifest.rights.expires_at) <= Date.parse(manifest.rights.verified_at)) {
    context.addIssue({ code: "custom", path: ["rights", "expires_at"], message: "A validade deve ser posterior à verificação." });
  }
});

export type TheologyImportManifest = z.infer<typeof TheologyImportManifestSchema>;

export function assertTheologyImportAllowed(manifest: TheologyImportManifest, now = new Date()): void {
  if (!Number.isFinite(now.getTime())) throw new Error("Data de verificação inválida.");
  if (!manifest.rights.store || !manifest.rights.automated_processing) {
    throw new Error("Direitos insuficientes: armazenamento e processamento automatizado são obrigatórios.");
  }
  if (manifest.rights.expires_at && Date.parse(manifest.rights.expires_at) <= now.getTime()) {
    throw new Error("Direitos expirados: importação bloqueada.");
  }
}
