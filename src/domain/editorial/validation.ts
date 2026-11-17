import { StudySchema, type Study } from "./schema";

/** Checks document integrity and editorial evidence; no claim of legal verification is inferred. */
export function validateStudy(input: unknown): string[] {
  const parsed = StudySchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const study = parsed.data;
  const d = study.dossier;
  const errors: string[] = [];
  if (!study.summary.trim() || !study.level.trim() || !study.author.trim() || !study.changelog.trim()) errors.push("Preencha resumo, nível, autor e changelog.");
  if (!d.question.trim() || !d.scope.trim()) errors.push("Preencha pergunta e escopo editoriais.");
  if (!d.passages.length || !d.topics.length) errors.push("Informe relações de passagem e tema.");
  if (d.rights_status !== "approved") errors.push("Direitos editoriais pendentes ou rejeitados.");
  if (!d.sources.length || !d.claims.length) errors.push("Inclua fontes e afirmações verificadas.");
  if (!study.sections.some((section) => section.content.trim() && section.claim_ids.length)) errors.push("Inclua seção publicável com referências a afirmações.");
  const sources = new Map(d.sources.map((source) => [source.id, source]));
  const claims = new Map(d.claims.map((claim) => [claim.id, claim]));
  if (sources.size !== d.sources.length || claims.size !== d.claims.length) errors.push("IDs de fontes e afirmações devem ser únicos.");
  for (const source of d.sources) {
    if (!source.rights_verified || !source.locations.length) errors.push(`Fonte ${source.id}: licença ou localização não verificada.`);
  }
  for (const claim of d.claims) {
    const source = sources.get(claim.source_id);
    if (!source || !source.locations.some((location) => location.id === claim.location_id)) errors.push(`Afirmação ${claim.id}: fonte ou localização ausente.`);
    if (claim.kind === "editorial_synthesis" && !claim.synthesis_notice.trim()) errors.push(`Afirmação ${claim.id}: identifique a síntese editorial.`);
  }
  for (const section of study.sections) {
    if (section.content.trim() && (!section.claim_ids.length || section.claim_ids.some((claimId) => !claims.has(claimId)))) errors.push(`Seção ${section.id}: afirmações ausentes ou inválidas.`);
  }
  return errors;
}

export function validatePublication(input: unknown): string[] {
  const errors = validateStudy(input);
  const parsed = StudySchema.safeParse(input);
  if (!parsed.success) return errors;
  const study: Study = parsed.data;
  if (study.status !== "approved") errors.push("O estudo precisa estar aprovado.");
  if (!study.reviewer.trim()) errors.push("Informe o revisor.");
  if (study.team_review && study.reviewer.trim().toLocaleLowerCase() === study.author.trim().toLocaleLowerCase()) errors.push("Em equipe, revisor e autor devem ser diferentes.");
  return errors;
}
