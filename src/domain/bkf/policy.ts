import type { EditorialState, Rights } from "./contracts";

const approval = new Set(["APPROVED_LIMITED", "APPROVED_FULL"]);
function usable(rights: Rights, now: Date): boolean {
  if (!approval.has(rights.status) || !rights.proof || !rights.verified_by || !Number.isFinite(now.getTime())) return false;
  const from = Date.parse(rights.valid_from); const until = rights.valid_until ? Date.parse(rights.valid_until) : Number.POSITIVE_INFINITY;
  return Number.isFinite(from) && Number.isFinite(until) && from <= now.getTime() && now.getTime() < until;
}
export function canStore(rights: Rights, now = new Date()): boolean { return usable(rights, now) && rights.permissions.store; }
export function canAutomatedProcess(rights: Rights, now = new Date()): boolean { return usable(rights, now) && rights.permissions.automated_processing; }
export function canQuote(rights: Rights, words: number, usedInWork: number, usedInDocument: number, now = new Date()): boolean {
  const l = rights.word_limits;
  return usable(rights, now) && rights.permissions.quote && !!l && Number.isSafeInteger(words) && words > 0 && words <= l.per_quote && usedInWork + words <= l.per_work && usedInDocument + words <= l.per_document;
}
const transitions: Record<EditorialState, readonly EditorialState[]> = {
  DRAFT:["RESEARCHED","NEEDS_SOURCES","RIGHTS_BLOCKED","REJECTED"], RESEARCHED:["EVIDENCE_VERIFIED","NEEDS_SOURCES","NEEDS_REVISION","RIGHTS_BLOCKED","REJECTED"], EVIDENCE_VERIFIED:["CRITICALLY_REVIEWED","NEEDS_REVISION","RIGHTS_BLOCKED"], CRITICALLY_REVIEWED:["HUMAN_APPROVAL","NEEDS_REVISION","REJECTED"], HUMAN_APPROVAL:["PUBLISHED","NEEDS_REVISION","REJECTED"], PUBLISHED:["SUPERSEDED","RETRACTED"], NEEDS_SOURCES:["RESEARCHED","REJECTED"], NEEDS_REVISION:["RESEARCHED","EVIDENCE_VERIFIED","REJECTED"], RIGHTS_BLOCKED:["DRAFT","REJECTED"], REJECTED:[], SUPERSEDED:[], RETRACTED:[] };
export function canTransition(from: EditorialState, to: EditorialState): boolean { return transitions[from].includes(to); }
