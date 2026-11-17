-- BKF-P0-002 — persistência e catálogo da Bereianos Knowledge Factory.
--
-- Numeração: o backlog previa `0002_bkf.sql`, mas `0002` já pertence a
-- `0002_blivre_query_indexes.sql` e `0003` a `0003_reading_personal_data.sql`
-- (colisão resolvida na tarefa C1). Esta migration é a próxima da sequência.
--
-- Aditiva: não altera, recria nem renomeia nada de 0000/0001/0002/0003. Reaproveita
-- `works`, `sources`, `licenses`, `profiles`, `studies`, `study_versions` e
-- `source_locations` existentes — não cria um segundo catálogo público.
--
-- Idempotente de propósito: pode ser reaplicada pelo fluxo de migração sem
-- duplicar objeto algum (`IF NOT EXISTS` em tabelas, tipos, colunas, índices e
-- constraints). Nenhuma linha de dado é inserida aqui.
--
-- NÃO aplicar em Supabase remoto sem autorização operacional explícita.
-- Direitos negam por padrão: as constraints abaixo impedem que permissão exista
-- sem status aprovado, que citação exista sem limite de palavras e que documento
-- seja publicado sem vínculo com o domínio SamJoE.

BEGIN;

-- ---------------------------------------------------------------------------
-- Tipos. Os valores são idênticos aos enums de src/domain/bkf/contracts.ts.
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_rights_status') THEN
    CREATE TYPE bkf_rights_status AS ENUM ('UNKNOWN','RESTRICTED','INTERNAL_REVIEW','APPROVED_LIMITED','APPROVED_FULL','BLOCKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_editorial_state') THEN
    CREATE TYPE bkf_editorial_state AS ENUM ('DRAFT','RESEARCHED','EVIDENCE_VERIFIED','CRITICALLY_REVIEWED','HUMAN_APPROVAL','PUBLISHED','NEEDS_SOURCES','NEEDS_REVISION','RIGHTS_BLOCKED','REJECTED','SUPERSEDED','RETRACTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_artifact_kind') THEN
    CREATE TYPE bkf_artifact_kind AS ENUM ('ORIGINAL','EXTRACTION','NORMALIZED','INDEX');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_evidence_category') THEN
    CREATE TYPE bkf_evidence_category AS ENUM ('QUOTE','PARAPHRASE','FACT','INFERENCE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_verification_state') THEN
    CREATE TYPE bkf_verification_state AS ENUM ('PENDING','VERIFIED','REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_job_stage') THEN
    CREATE TYPE bkf_job_stage AS ENUM ('INGEST','INDEX','RESEARCH','ANALYSIS','REVIEW','PUBLISH');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_job_state') THEN
    CREATE TYPE bkf_job_state AS ENUM ('QUEUED','RUNNING','SUCCEEDED','FAILED','BLOCKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bkf_review_decision') THEN
    CREATE TYPE bkf_review_decision AS ENUM ('APPROVED','CHANGES_REQUESTED','REJECTED');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Edições e direitos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bkf_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id),
  source_id uuid REFERENCES sources(id),
  license_id uuid REFERENCES licenses(id),
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  language text NOT NULL CHECK (char_length(btrim(language)) >= 2),
  edition_label text NOT NULL CHECK (char_length(btrim(edition_label)) > 0),
  translation_of text,
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_id, edition_label, language)
);

-- Direitos por edição: nunca inferidos de gratuidade, idade da obra ou de outra
-- tradução. Sem registro aprovado e vigente, nada pode ser armazenado ou citado.
CREATE TABLE IF NOT EXISTS bkf_rights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES bkf_editions(id) ON DELETE RESTRICT,
  status bkf_rights_status NOT NULL DEFAULT 'UNKNOWN',
  store boolean NOT NULL DEFAULT false,
  automated_processing boolean NOT NULL DEFAULT false,
  quote boolean NOT NULL DEFAULT false,
  public_distribution boolean NOT NULL DEFAULT false,
  proof text NOT NULL DEFAULT '',
  verified_by text NOT NULL DEFAULT '',
  verified_at timestamptz,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  territory text NOT NULL CHECK (char_length(btrim(territory)) > 0),
  attribution text NOT NULL CHECK (char_length(btrim(attribution)) > 0),
  words_per_quote integer CHECK (words_per_quote IS NULL OR words_per_quote >= 0),
  words_per_work integer CHECK (words_per_work IS NULL OR words_per_work >= 0),
  words_per_document integer CHECK (words_per_document IS NULL OR words_per_document >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bkf_rights_validity_window CHECK (valid_until IS NULL OR valid_until > valid_from),
  -- Permissão nenhuma sem aprovação explícita.
  CONSTRAINT bkf_rights_permission_requires_approval CHECK (
    NOT (store OR automated_processing OR quote OR public_distribution)
    OR status IN ('APPROVED_LIMITED','APPROVED_FULL')
  ),
  -- Aprovação exige prova documental, responsável e data de verificação.
  CONSTRAINT bkf_rights_approval_requires_proof CHECK (
    status NOT IN ('APPROVED_LIMITED','APPROVED_FULL')
    OR (char_length(btrim(proof)) > 0 AND char_length(btrim(verified_by)) > 0 AND verified_at IS NOT NULL)
  ),
  -- Reprodução sem limite de palavras é proibida.
  CONSTRAINT bkf_rights_quote_requires_limits CHECK (
    quote = false
    OR (words_per_quote IS NOT NULL AND words_per_work IS NOT NULL AND words_per_document IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS bkf_rights_edition_idx ON bkf_rights(edition_id, status);

-- Direitos vigentes da edição. Coluna adicionada depois da tabela de direitos
-- para evitar FK circular; permanece opcional porque a edição pode existir em
-- investigação de direitos (status UNKNOWN) sem nada liberado.
ALTER TABLE bkf_editions ADD COLUMN IF NOT EXISTS current_rights_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bkf_editions_current_rights_fk') THEN
    ALTER TABLE bkf_editions
      ADD CONSTRAINT bkf_editions_current_rights_fk
      FOREIGN KEY (current_rights_id) REFERENCES bkf_rights(id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Corpus imutável: original por hash, extração, estrutura e fragmentos
-- ---------------------------------------------------------------------------

-- `storage_locator` é caminho relativo dentro da raiz privada configurada pelo
-- operador — nunca em `public/`, nunca no bundle, nunca no Git. A deduplicação é
-- por (edição, hash do original, versão da extração).
CREATE TABLE IF NOT EXISTS bkf_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES bkf_editions(id) ON DELETE RESTRICT,
  kind bkf_artifact_kind NOT NULL,
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[a-f0-9]{64}$'),
  extraction_version text NOT NULL CHECK (char_length(btrim(extraction_version)) > 0),
  normalized_sha256 text CHECK (normalized_sha256 IS NULL OR normalized_sha256 ~ '^[a-f0-9]{64}$'),
  byte_size bigint CHECK (byte_size IS NULL OR byte_size >= 0),
  storage_locator text NOT NULL CHECK (
    char_length(storage_locator) BETWEEN 1 AND 512
    AND storage_locator !~ '^[/\\]'
    AND storage_locator !~ '^[A-Za-z]:'
    AND storage_locator NOT LIKE '%..%'
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, original_sha256, extraction_version)
);

CREATE INDEX IF NOT EXISTS bkf_artifacts_edition_kind_idx ON bkf_artifacts(edition_id, kind);

-- Estrutura declarada pelo manifesto do operador: nada de paginação inventada.
CREATE TABLE IF NOT EXISTS bkf_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES bkf_artifacts(id) ON DELETE RESTRICT,
  locator text NOT NULL CHECK (char_length(btrim(locator)) > 0),
  title text,
  order_no integer NOT NULL CHECK (order_no > 0),
  start_offset integer NOT NULL CHECK (start_offset >= 0),
  end_offset integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bkf_sections_range CHECK (end_offset > start_offset),
  UNIQUE (artifact_id, order_no),
  UNIQUE (artifact_id, locator)
);

-- Offsets `[start,end)` em UTF-16 da extração normalizada, como no contrato.
CREATE TABLE IF NOT EXISTS bkf_fragments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES bkf_artifacts(id) ON DELETE RESTRICT,
  section_id uuid REFERENCES bkf_sections(id),
  locator text NOT NULL CHECK (char_length(btrim(locator)) > 0),
  start_offset integer NOT NULL CHECK (start_offset >= 0),
  end_offset integer NOT NULL,
  text text NOT NULL,
  previous_text text NOT NULL DEFAULT '',
  next_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bkf_fragments_range CHECK (end_offset > start_offset),
  UNIQUE (artifact_id, start_offset, end_offset)
);

CREATE INDEX IF NOT EXISTS bkf_fragments_artifact_offset_idx ON bkf_fragments(artifact_id, start_offset);
CREATE INDEX IF NOT EXISTS bkf_fragments_section_idx ON bkf_fragments(section_id);

-- ---------------------------------------------------------------------------
-- Jobs com checkpoint (retomada de ingestão/indexação)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bkf_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage bkf_job_stage NOT NULL,
  state bkf_job_state NOT NULL DEFAULT 'QUEUED',
  edition_id uuid REFERENCES bkf_editions(id),
  artifact_id uuid REFERENCES bkf_artifacts(id),
  input_version text NOT NULL CHECK (char_length(btrim(input_version)) > 0),
  checkpoint jsonb NOT NULL DEFAULT '{}',
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Bloqueio precisa de motivo registrado: ausência de dependência é bloqueio,
  -- nunca sucesso simulado.
  CONSTRAINT bkf_jobs_blocked_requires_reason CHECK (
    state <> 'BLOCKED' OR char_length(btrim(coalesce(blocked_reason, ''))) > 0
  )
);

CREATE INDEX IF NOT EXISTS bkf_jobs_state_stage_idx ON bkf_jobs(state, stage, created_at);

-- ---------------------------------------------------------------------------
-- Evidência contextual, ligada a direitos e ao catálogo existente
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bkf_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fragment_id uuid NOT NULL REFERENCES bkf_fragments(id) ON DELETE RESTRICT,
  edition_id uuid NOT NULL REFERENCES bkf_editions(id) ON DELETE RESTRICT,
  rights_id uuid NOT NULL REFERENCES bkf_rights(id) ON DELETE RESTRICT,
  source_location_id uuid REFERENCES source_locations(id),
  start_offset integer NOT NULL CHECK (start_offset >= 0),
  end_offset integer NOT NULL,
  category bkf_evidence_category NOT NULL,
  verification_state bkf_verification_state NOT NULL DEFAULT 'PENDING',
  word_count integer NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  verification_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bkf_evidence_range CHECK (end_offset > start_offset),
  UNIQUE (fragment_id, start_offset, end_offset, category)
);

CREATE INDEX IF NOT EXISTS bkf_evidence_fragment_idx ON bkf_evidence(fragment_id);
CREATE INDEX IF NOT EXISTS bkf_evidence_state_idx ON bkf_evidence(verification_state, category);

-- ---------------------------------------------------------------------------
-- Documentos, revisões imutáveis e revisão humana
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bkf_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) > 0),
  dossier_question text NOT NULL CHECK (char_length(btrim(dossier_question)) > 0),
  scope text NOT NULL DEFAULT '',
  coverage text NOT NULL DEFAULT '',
  state bkf_editorial_state NOT NULL DEFAULT 'DRAFT',
  study_id uuid REFERENCES studies(id),
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Publicação só existe atrelada ao domínio público SamJoE.
  CONSTRAINT bkf_documents_published_requires_study CHECK (
    state <> 'PUBLISHED' OR study_id IS NOT NULL
  )
);

-- Versão imutável: conteúdo endereçado por hash, uma linha por versão.
CREATE TABLE IF NOT EXISTS bkf_document_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES bkf_documents(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  state bkf_editorial_state NOT NULL,
  payload jsonb NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  author_id uuid REFERENCES profiles(id),
  study_version_id uuid REFERENCES study_versions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version),
  UNIQUE (document_id, content_sha256)
);

CREATE INDEX IF NOT EXISTS bkf_document_revisions_document_idx ON bkf_document_revisions(document_id, version DESC);

ALTER TABLE bkf_documents ADD COLUMN IF NOT EXISTS current_revision_id uuid;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bkf_documents_current_revision_fk') THEN
    ALTER TABLE bkf_documents
      ADD CONSTRAINT bkf_documents_current_revision_fk
      FOREIGN KEY (current_revision_id) REFERENCES bkf_document_revisions(id);
  END IF;
END $$;

-- Uma decisão por revisor por revisão; independência registrada explicitamente.
CREATE TABLE IF NOT EXISTS bkf_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_revision_id uuid NOT NULL REFERENCES bkf_document_revisions(id) ON DELETE RESTRICT,
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  independent boolean NOT NULL DEFAULT false,
  decision bkf_review_decision NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_revision_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS bkf_reviews_revision_idx ON bkf_reviews(document_revision_id, decision);

-- ---------------------------------------------------------------------------
-- Imutabilidade do que é versionado
-- ---------------------------------------------------------------------------

-- Artefato, fragmento e revisão de documento são registros imutáveis: mudança de
-- edição, hash ou versão de extração cria uma nova linha, nunca reescreve a
-- anterior. O banco recusa UPDATE e DELETE nessas tabelas.
CREATE OR REPLACE FUNCTION bkf_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bkf: % em % é proibido; registros versionados são imutáveis', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bkf_artifacts_immutable ON bkf_artifacts;
CREATE TRIGGER bkf_artifacts_immutable
  BEFORE UPDATE OR DELETE ON bkf_artifacts
  FOR EACH ROW EXECUTE FUNCTION bkf_block_mutation();

DROP TRIGGER IF EXISTS bkf_fragments_immutable ON bkf_fragments;
CREATE TRIGGER bkf_fragments_immutable
  BEFORE UPDATE OR DELETE ON bkf_fragments
  FOR EACH ROW EXECUTE FUNCTION bkf_block_mutation();

DROP TRIGGER IF EXISTS bkf_document_revisions_immutable ON bkf_document_revisions;
CREATE TRIGGER bkf_document_revisions_immutable
  BEFORE UPDATE OR DELETE ON bkf_document_revisions
  FOR EACH ROW EXECUTE FUNCTION bkf_block_mutation();

COMMIT;
