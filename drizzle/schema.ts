// SQL migration is authoritative for constraints, triggers, and defaults.
import { pgTable, pgEnum, uuid, text, integer, bigint, boolean, numeric, timestamp, jsonb, smallint, primaryKey } from "drizzle-orm/pg-core";

export const editorialStatus = pgEnum("editorial_status", ["draft", "in_review", "approved", "published", "archived"]);
export const accessLevel = pgEnum("access_level", ["free", "premium"]);
export const subscriptionStatus = pgEnum("subscription_status", ["pending", "active", "grace", "past_due", "canceled", "expired", "refunded"]);
export const profileRole = pgEnum("profile_role", ["reader", "editor", "admin"]);
export const readingHighlightColor = pgEnum("reading_highlight_color", ["yellow", "green", "blue", "pink", "purple"]);
export const readingFontFamily = pgEnum("reading_font_family", ["serif", "sans", "dyslexic"]);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  displayName: text("display_name"),
  role: profileRole("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const licenses = pgTable("licenses", {
  id: uuid("id").primaryKey(),
  holder: text("holder").notNull(),
  evidenceUrl: text("evidence_url").notNull(),
  permissions: text("permissions").notNull(),
  restrictions: text("restrictions"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const translations = pgTable("translations", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  language: text("language").notNull(),
  canon: text("canon").notNull(),
  licenseId: uuid("license_id"),
  status: text("status").notNull(),
  attribution: text("attribution").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const books = pgTable("books", {
  id: uuid("id").primaryKey(),
  translationId: uuid("translation_id").notNull(),
  code: text("code").notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  orderNo: integer("order_no").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const chapters = pgTable("chapters", {
  id: uuid("id").primaryKey(),
  bookId: uuid("book_id").notNull(),
  number: integer("number").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verses = pgTable("verses", {
  id: uuid("id").primaryKey(),
  chapterId: uuid("chapter_id").notNull(),
  number: integer("number").notNull(),
  content: text("content").notNull(),
  published: boolean("published").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const studies = pgTable("studies", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  type: text("type").notNull(),
  level: text("level").notNull(),
  status: editorialStatus("status").notNull(),
  access: accessLevel("access").notNull(),
  publishedVersionId: uuid("published_version_id"),
  reviewerId: uuid("reviewer_id"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const studyVersions = pgTable("study_versions", {
  id: uuid("id").primaryKey(),
  studyId: uuid("study_id").notNull(),
  version: integer("version").notNull(),
  changelog: text("changelog").notNull(),
  authorId: uuid("author_id").notNull(),
  reviewerId: uuid("reviewer_id"),
  status: editorialStatus("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const studySections = pgTable("study_sections", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  title: text("title").notNull(),
  orderNo: integer("order_no").notNull(),
  content: text("content").notNull(),
  visibility: accessLevel("visibility").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sources = pgTable("sources", {
  id: uuid("id").primaryKey(),
  work: text("work").notNull(),
  author: text("author").notNull(),
  publisher: text("publisher"),
  edition: text("edition"),
  year: integer("year"),
  identifier: text("identifier"),
  licenseId: uuid("license_id"),
  editorialReliability: text("editorial_reliability"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sourceLocations = pgTable("source_locations", {
  id: uuid("id").primaryKey(),
  sourceId: uuid("source_id").notNull(),
  locator: text("locator").notNull(),
  permittedExcerpt: text("permitted_excerpt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const sourceClaims = pgTable("source_claims", {
  id: uuid("id").primaryKey(),
  versionId: uuid("version_id").notNull(),
  claim: text("claim").notNull(),
  sourceLocationId: uuid("source_location_id"),
  kind: text("kind").notNull(),
  verificationNote: text("verification_note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: editorialStatus("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const authors = pgTable("authors", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const works = pgTable("works", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  licenseId: uuid("license_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const traditions = pgTable("traditions", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const debates = pgTable("debates", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const studyPassages = pgTable("study_passages", {
  id: uuid("id").primaryKey(),
  studyId: uuid("study_id").notNull(),
  reference: text("reference").notNull(),
  relationType: text("relation_type").notNull(),
  confidence: numeric("confidence").notNull(),
  editorialNote: text("editorial_note").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const studyTopics = pgTable("study_topics", {
  id: uuid("id").primaryKey(),
  studyId: uuid("study_id").notNull(),
  topicId: uuid("topic_id").notNull(),
  relationType: text("relation_type").notNull(),
  confidence: numeric("confidence").notNull(),
  editorialNote: text("editorial_note").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const studyAuthors = pgTable("study_authors", {
  id: uuid("id").primaryKey(),
  studyId: uuid("study_id").notNull(),
  authorId: uuid("author_id").notNull(),
  relationType: text("relation_type").notNull(),
  confidence: numeric("confidence").notNull(),
  editorialNote: text("editorial_note").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const workAuthors = pgTable("work_authors", {
  id: uuid("id").primaryKey(),
  workId: uuid("work_id").notNull(),
  authorId: uuid("author_id").notNull(),
  relationType: text("relation_type").notNull(),
  confidence: numeric("confidence").notNull(),
  editorialNote: text("editorial_note").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const workTopics = pgTable("work_topics", {
  id: uuid("id").primaryKey(),
  workId: uuid("work_id").notNull(),
  topicId: uuid("topic_id").notNull(),
  relationType: text("relation_type").notNull(),
  confidence: numeric("confidence").notNull(),
  editorialNote: text("editorial_note").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const debateTopics = pgTable("debate_topics", {
  id: uuid("id").primaryKey(),
  debateId: uuid("debate_id").notNull(),
  topicId: uuid("topic_id").notNull(),
  relationType: text("relation_type").notNull(),
  confidence: numeric("confidence").notNull(),
  editorialNote: text("editorial_note").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const debateTraditions = pgTable("debate_traditions", {
  id: uuid("id").primaryKey(),
  debateId: uuid("debate_id").notNull(),
  traditionId: uuid("tradition_id").notNull(),
  relationType: text("relation_type").notNull(),
  confidence: numeric("confidence").notNull(),
  editorialNote: text("editorial_note").notNull(),
  versionId: uuid("version_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const plans = pgTable("plans", {
  id: uuid("id").primaryKey(),
  key: text("key").notNull(),
  version: integer("version").notNull(),
  priceMinor: integer("price_minor").notNull(),
  currency: text("currency").notNull(),
  period: text("period").notNull(),
  features: jsonb("features").notNull(),
  status: text("status").notNull(),
  renewalText: text("renewal_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  planId: uuid("plan_id").notNull(),
  status: subscriptionStatus("status").notNull(),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const paymentEvents = pgTable("payment_events", {
  id: uuid("id").primaryKey(),
  provider: text("provider").notNull(),
  externalEventId: text("external_event_id").notNull(),
  type: text("type").notNull(),
  subscriptionId: uuid("subscription_id"),
  minimizedPayload: jsonb("minimized_payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  result: text("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const entitlements = pgTable("entitlements", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  feature: text("feature").notNull(),
  resourceId: uuid("resource_id"),
  sourceSubscriptionId: uuid("source_subscription_id"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  state: text("state").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey(),
  actorId: uuid("actor_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: uuid("resource_id"),
  result: text("result").notNull(),
  minimizedMetadata: jsonb("minimized_metadata").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const readingPreferences = pgTable("reading_preferences", {
  userId: uuid("user_id").primaryKey(),
  theme: text("theme").notNull(),
  fontFamily: readingFontFamily("font_family").notNull(),
  fontSize: smallint("font_size").notNull(),
  lineHeight: numeric("line_height").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verseNotes = pgTable("verse_notes", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  verseId: uuid("verse_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const verseHighlights = pgTable("verse_highlights", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  verseId: uuid("verse_id").notNull(),
  color: readingHighlightColor("color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const chapterReadingProgress = pgTable("chapter_reading_progress", {
  userId: uuid("user_id").notNull(),
  chapterId: uuid("chapter_id").notNull(),
  lastVerseId: uuid("last_verse_id"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.chapterId] })]);

// ---------------------------------------------------------------------------
// BKF — Bereianos Knowledge Factory (drizzle/0004_bkf.sql).
// Valores dos enums idênticos a src/domain/bkf/contracts.ts. O SQL segue sendo a
// autoridade: constraints, triggers de imutabilidade e defaults vivem na migration.
// ---------------------------------------------------------------------------

export const bkfRightsStatus = pgEnum("bkf_rights_status", ["UNKNOWN", "RESTRICTED", "INTERNAL_REVIEW", "APPROVED_LIMITED", "APPROVED_FULL", "BLOCKED"]);
export const bkfEditorialState = pgEnum("bkf_editorial_state", ["DRAFT", "RESEARCHED", "EVIDENCE_VERIFIED", "CRITICALLY_REVIEWED", "HUMAN_APPROVAL", "PUBLISHED", "NEEDS_SOURCES", "NEEDS_REVISION", "RIGHTS_BLOCKED", "REJECTED", "SUPERSEDED", "RETRACTED"]);
export const bkfArtifactKind = pgEnum("bkf_artifact_kind", ["ORIGINAL", "EXTRACTION", "NORMALIZED", "INDEX"]);
export const bkfEvidenceCategory = pgEnum("bkf_evidence_category", ["QUOTE", "PARAPHRASE", "FACT", "INFERENCE"]);
export const bkfVerificationState = pgEnum("bkf_verification_state", ["PENDING", "VERIFIED", "REJECTED"]);
export const bkfJobStage = pgEnum("bkf_job_stage", ["INGEST", "INDEX", "RESEARCH", "ANALYSIS", "REVIEW", "PUBLISH"]);
export const bkfJobState = pgEnum("bkf_job_state", ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "BLOCKED"]);
export const bkfReviewDecision = pgEnum("bkf_review_decision", ["APPROVED", "CHANGES_REQUESTED", "REJECTED"]);

export const bkfEditions = pgTable("bkf_editions", {
  id: uuid("id").primaryKey(),
  workId: uuid("work_id").notNull(),
  sourceId: uuid("source_id"),
  licenseId: uuid("license_id"),
  title: text("title").notNull(),
  language: text("language").notNull(),
  editionLabel: text("edition_label").notNull(),
  translationOf: text("translation_of"),
  sourceUrl: text("source_url").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  currentRightsId: uuid("current_rights_id"),
});

export const bkfRights = pgTable("bkf_rights", {
  id: uuid("id").primaryKey(),
  editionId: uuid("edition_id").notNull(),
  status: bkfRightsStatus("status").notNull(),
  store: boolean("store").notNull(),
  automatedProcessing: boolean("automated_processing").notNull(),
  quote: boolean("quote").notNull(),
  publicDistribution: boolean("public_distribution").notNull(),
  proof: text("proof").notNull(),
  verifiedBy: text("verified_by").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  territory: text("territory").notNull(),
  attribution: text("attribution").notNull(),
  wordsPerQuote: integer("words_per_quote"),
  wordsPerWork: integer("words_per_work"),
  wordsPerDocument: integer("words_per_document"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const bkfArtifacts = pgTable("bkf_artifacts", {
  id: uuid("id").primaryKey(),
  editionId: uuid("edition_id").notNull(),
  kind: bkfArtifactKind("kind").notNull(),
  originalSha256: text("original_sha256").notNull(),
  extractionVersion: text("extraction_version").notNull(),
  normalizedSha256: text("normalized_sha256"),
  byteSize: bigint("byte_size", { mode: "number" }),
  storageLocator: text("storage_locator").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const bkfSections = pgTable("bkf_sections", {
  id: uuid("id").primaryKey(),
  artifactId: uuid("artifact_id").notNull(),
  locator: text("locator").notNull(),
  title: text("title"),
  orderNo: integer("order_no").notNull(),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const bkfFragments = pgTable("bkf_fragments", {
  id: uuid("id").primaryKey(),
  artifactId: uuid("artifact_id").notNull(),
  sectionId: uuid("section_id"),
  locator: text("locator").notNull(),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  text: text("text").notNull(),
  previousText: text("previous_text").notNull(),
  nextText: text("next_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const bkfJobs = pgTable("bkf_jobs", {
  id: uuid("id").primaryKey(),
  stage: bkfJobStage("stage").notNull(),
  state: bkfJobState("state").notNull(),
  editionId: uuid("edition_id"),
  artifactId: uuid("artifact_id"),
  inputVersion: text("input_version").notNull(),
  checkpoint: jsonb("checkpoint").notNull(),
  blockedReason: text("blocked_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const bkfEvidence = pgTable("bkf_evidence", {
  id: uuid("id").primaryKey(),
  fragmentId: uuid("fragment_id").notNull(),
  editionId: uuid("edition_id").notNull(),
  rightsId: uuid("rights_id").notNull(),
  sourceLocationId: uuid("source_location_id"),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  category: bkfEvidenceCategory("category").notNull(),
  verificationState: bkfVerificationState("verification_state").notNull(),
  wordCount: integer("word_count").notNull(),
  verificationNote: text("verification_note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const bkfDocuments = pgTable("bkf_documents", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  dossierQuestion: text("dossier_question").notNull(),
  scope: text("scope").notNull(),
  coverage: text("coverage").notNull(),
  state: bkfEditorialState("state").notNull(),
  studyId: uuid("study_id"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  currentRevisionId: uuid("current_revision_id"),
});

export const bkfDocumentRevisions = pgTable("bkf_document_revisions", {
  id: uuid("id").primaryKey(),
  documentId: uuid("document_id").notNull(),
  version: integer("version").notNull(),
  state: bkfEditorialState("state").notNull(),
  payload: jsonb("payload").notNull(),
  contentSha256: text("content_sha256").notNull(),
  authorId: uuid("author_id"),
  studyVersionId: uuid("study_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const bkfReviews = pgTable("bkf_reviews", {
  id: uuid("id").primaryKey(),
  documentRevisionId: uuid("document_revision_id").notNull(),
  reviewerId: uuid("reviewer_id").notNull(),
  independent: boolean("independent").notNull(),
  decision: bkfReviewDecision("decision").notNull(),
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------------------
// Corpora de idiomas originais (drizzle/0005_original_languages.sql).
// Texto, morfologia e lexico sao ativos separados, com licenca e aprovacao
// proprias. O SQL segue sendo a autoridade: constraints, trigger de licenca da
// morfologia e defaults vivem na migration.
// ---------------------------------------------------------------------------

export const originalLanguage = pgEnum("original_language", ["hbo", "grc"]);
export const originalAssetKind = pgEnum("original_asset_kind", ["text", "text_morphology"]);
export const originalEditionStatus = pgEnum("original_edition_status", ["collected", "under_review", "approved", "blocked"]);

export const originalEditions = pgTable("original_editions", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull(),
  language: originalLanguage("language").notNull(),
  assetKind: originalAssetKind("asset_kind").notNull(),
  corpus: text("corpus").notNull(),
  version: text("version").notNull(),
  sourceUrl: text("source_url").notNull(),
  licenseId: uuid("license_id"),
  licenseDeclared: text("license_declared").notNull(),
  attribution: text("attribution").notNull(),
  sourceSha256: text("source_sha256").notNull(),
  status: originalEditionStatus("status").notNull(),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  importedAt: timestamp("imported_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const originalVerses = pgTable("original_verses", {
  id: uuid("id").primaryKey(),
  editionId: uuid("edition_id").notNull(),
  canonBook: text("canon_book").notNull(),
  chapter: integer("chapter").notNull(),
  verse: integer("verse").notNull(),
  canonicalRef: text("canonical_ref").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const originalTokens = pgTable("original_tokens", {
  id: uuid("id").primaryKey(),
  verseId: uuid("verse_id").notNull(),
  position: integer("position").notNull(),
  surface: text("surface").notNull(),
  normalized: text("normalized").notNull(),
  sourceTokenId: text("source_token_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const lemmas = pgTable("lemmas", {
  id: uuid("id").primaryKey(),
  language: originalLanguage("language").notNull(),
  lemma: text("lemma").notNull(),
  strongId: text("strong_id"),
  transliteration: text("transliteration"),
  sourceEditionId: uuid("source_edition_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const originalMorphemes = pgTable("original_morphemes", {
  id: uuid("id").primaryKey(),
  tokenId: uuid("token_id").notNull(),
  morphologyEditionId: uuid("morphology_edition_id").notNull(),
  position: integer("position").notNull(),
  surface: text("surface").notNull(),
  lemmaId: uuid("lemma_id"),
  morphologyCode: text("morphology_code").notNull(),
  sourceMorphemeId: text("source_morpheme_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const lexiconEntries = pgTable("lexicon_entries", {
  id: uuid("id").primaryKey(),
  lemmaId: uuid("lemma_id").notNull(),
  language: text("language").notNull(),
  definition: text("definition").notNull(),
  gloss: text("gloss"),
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
  licenseId: uuid("license_id"),
  licenseDeclared: text("license_declared").notNull(),
  attribution: text("attribution").notNull(),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
