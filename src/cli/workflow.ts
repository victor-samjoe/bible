import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { StudySchema, type Study } from "../domain/editorial/schema";
import { validatePublication, validateStudy } from "../domain/editorial/validation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fileFor = (directory: string, id: string) => {
  if (!uuid.test(id)) throw new Error("ID de rascunho inválido.");
  return join(directory, `${id}.json`);
};

export async function loadStudy(directory: string, id: string): Promise<Study> {
  return StudySchema.parse(JSON.parse(await readFile(fileFor(directory, id), "utf8")));
}

async function saveStudy(directory: string, study: Study): Promise<void> {
  StudySchema.parse(study);
  await mkdir(directory, { recursive: true });
  const destination = fileFor(directory, study.id);
  const temporary = join(directory, `.${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(study, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, destination);
}

export async function newStudy(directory: string, topic: string, passage: string, type: string): Promise<Study> {
  if (![topic, passage, type].every((value) => value.trim())) throw new Error("Informe --topic, --passage e --type.");
  const id = randomUUID();
  const study: Study = {
    id, version_id: randomUUID(), status: "draft", title: topic.trim(), summary: "", type: type.trim(), level: "", author: "", reviewer: "", team_review: true, changelog: "",
    sections: [], dossier: { schema_version: 1, draft_id: id, question: `Qual é a questão editorial sobre ${topic.trim()}?`, scope: "", passages: [passage.trim()], topics: [topic.trim()], sources: [], claims: [], open_questions: ["Quais fontes e permissões foram verificadas?"], rights_status: "pending", editorial_risks: [], token_budget_used: 0 },
  };
  await saveStudy(directory, study);
  return study;
}

export async function research(directory: string, id: string): Promise<Study> {
  const study = await loadStudy(directory, id);
  if (study.status !== "draft") throw new Error("Pesquisa só pode ser preparada em rascunho.");
  // The dossier is operator-maintained. Never fabricate research or replace existing evidence.
  await saveStudy(directory, study);
  return study;
}

export async function draft(directory: string, id: string): Promise<Study> {
  const study = await loadStudy(directory, id);
  if (study.status !== "draft") throw new Error("Somente rascunhos podem ser editados.");
  if (!study.sections.length) study.sections.push({ id: randomUUID(), title: "Conteúdo editorial pendente", content: "", visibility: "free", claim_ids: [] });
  await saveStudy(directory, study);
  return study;
}

export async function submit(directory: string, id: string): Promise<void> {
  const study = await loadStudy(directory, id);
  if (study.status !== "draft") throw new Error("Somente rascunhos podem ser enviados para revisão.");
  const errors = validateStudy(study);
  if (errors.length) throw new Error(errors.join("\n"));
  study.status = "in_review";
  await saveStudy(directory, study);
}

export async function publish(directory: string, id: string): Promise<never> {
  const study = await loadStudy(directory, id);
  const errors = validatePublication(study);
  if (errors.length) throw new Error(errors.join("\n"));
  // Local files cannot establish an authenticated admin, immutable history, audit or cache invalidation.
  throw new Error("Publicação indisponível: requer banco, autenticação de administrador, auditoria e invalidação de cache integrados.");
}
