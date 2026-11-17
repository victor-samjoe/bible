// SQL migration is authoritative for constraints, triggers, and defaults.
import { pgTable, pgEnum, uuid, text, integer, boolean, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";

export const editorialStatus = pgEnum("editorial_status", ["draft", "in_review", "approved", "published", "archived"]);
export const accessLevel = pgEnum("access_level", ["free", "premium"]);
export const subscriptionStatus = pgEnum("subscription_status", ["pending", "active", "grace", "past_due", "canceled", "expired", "refunded"]);
export const profileRole = pgEnum("profile_role", ["reader", "editor", "admin"]);

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
