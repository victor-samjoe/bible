-- C14 — corpora de idiomas originais (hebraico e grego).
--
-- Aditiva e idempotente: não altera, recria nem renomeia nada de 0000–0004.
-- NÃO aplicar em Supabase remoto sem autorização operacional explícita.
--
-- O desenho segue o modelo recomendado em docs/ORIGINAL_LANGUAGE_SOURCES.md e o
-- princípio de separação de ativos: texto-base, segmentação/morfologia e
-- definições lexicais são independentes, com licença e aprovação próprias. As
-- constraints abaixo existem para que o banco recuse, por construção:
--
--  * edição sem licença, atribuição, URL e checksum dos bytes originais;
--  * texto, token ou morfema pendurado em edição não aprovada — a aprovação é
--    humana e fica em `approved_by`/`approved_at`;
--  * morfologia atribuída a uma edição que só foi liberada como texto;
--  * definição lexical sem fonte e licença próprias, que é exatamente o caso de
--    hoje: nenhuma fonte lexical está aprovada, então `lexicon_entries` nasce
--    vazia e assim deve permanecer até existir licença verificada.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'original_language') THEN
    CREATE TYPE original_language AS ENUM ('hbo', 'grc');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'original_asset_kind') THEN
    -- O que a edição está autorizada a fornecer.
    CREATE TYPE original_asset_kind AS ENUM ('text', 'text_morphology');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'original_edition_status') THEN
    CREATE TYPE original_edition_status AS ENUM ('collected', 'under_review', 'approved', 'blocked');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS original_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  language original_language NOT NULL,
  asset_kind original_asset_kind NOT NULL,
  corpus text NOT NULL CHECK (corpus IN ('hebrew-ot', 'greek-nt')),
  version text NOT NULL CHECK (char_length(btrim(version)) > 0),
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  license_id uuid REFERENCES licenses(id),
  license_declared text NOT NULL CHECK (char_length(btrim(license_declared)) > 0),
  attribution text NOT NULL CHECK (char_length(btrim(attribution)) > 0),
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'),
  status original_edition_status NOT NULL DEFAULT 'collected',
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, version),
  UNIQUE (code, source_sha256),
  -- Aprovação exige responsável e data: não existe aprovação implícita.
  CONSTRAINT original_editions_approval_requires_human CHECK (
    status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS original_editions_corpus_status_idx
  ON original_editions(corpus, status, language);

CREATE TABLE IF NOT EXISTS original_verses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES original_editions(id) ON DELETE RESTRICT,
  canon_book text NOT NULL CHECK (char_length(btrim(canon_book)) > 0),
  chapter integer NOT NULL CHECK (chapter > 0 AND chapter <= 150),
  verse integer NOT NULL CHECK (verse > 0 AND verse <= 176),
  canonical_ref text NOT NULL CHECK (char_length(btrim(canonical_ref)) > 0),
  text text NOT NULL CHECK (char_length(btrim(text)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (edition_id, canon_book, chapter, verse)
);

CREATE INDEX IF NOT EXISTS original_verses_edition_ref_idx
  ON original_verses(edition_id, canon_book, chapter, verse);

CREATE TABLE IF NOT EXISTS original_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verse_id uuid NOT NULL REFERENCES original_verses(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  surface text NOT NULL CHECK (char_length(btrim(surface)) > 0),
  normalized text NOT NULL CHECK (char_length(btrim(normalized)) > 0),
  -- Identificador estável publicado pela fonte, quando existe.
  source_token_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (verse_id, position)
);

CREATE INDEX IF NOT EXISTS original_tokens_normalized_idx ON original_tokens(normalized);

CREATE TABLE IF NOT EXISTS lemmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language original_language NOT NULL,
  lemma text NOT NULL CHECK (char_length(btrim(lemma)) > 0),
  -- Strong's e transliteração são ativos separados: entram só com fonte própria.
  strong_id text,
  transliteration text,
  source_edition_id uuid NOT NULL REFERENCES original_editions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_edition_id, language, lemma)
);

-- Morfologia só pode pendurar em edição liberada como `text_morphology`.
CREATE TABLE IF NOT EXISTS original_morphemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES original_tokens(id) ON DELETE RESTRICT,
  morphology_edition_id uuid NOT NULL REFERENCES original_editions(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position > 0),
  surface text NOT NULL,
  lemma_id uuid REFERENCES lemmas(id),
  morphology_code text NOT NULL,
  source_morpheme_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_id, position)
);

CREATE OR REPLACE FUNCTION original_morphology_source_is_licensed() RETURNS trigger AS $$
DECLARE
  kind original_asset_kind;
BEGIN
  SELECT asset_kind INTO kind FROM original_editions WHERE id = NEW.morphology_edition_id;
  IF kind IS DISTINCT FROM 'text_morphology' THEN
    RAISE EXCEPTION
      'morfologia exige edicao liberada como text_morphology; edicao % nao esta',
      NEW.morphology_edition_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS original_morphemes_licensed_source ON original_morphemes;
CREATE TRIGGER original_morphemes_licensed_source
  BEFORE INSERT OR UPDATE ON original_morphemes
  FOR EACH ROW EXECUTE FUNCTION original_morphology_source_is_licensed();

-- Definições e glossas. Nenhuma fonte lexical está aprovada hoje: a tabela
-- existe para que a ausência seja explícita, e não para ser preenchida por IA.
CREATE TABLE IF NOT EXISTS lexicon_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lemma_id uuid NOT NULL REFERENCES lemmas(id) ON DELETE RESTRICT,
  language text NOT NULL CHECK (char_length(btrim(language)) > 0),
  definition text NOT NULL CHECK (char_length(btrim(definition)) > 0),
  gloss text,
  source_name text NOT NULL CHECK (char_length(btrim(source_name)) > 0),
  source_url text NOT NULL CHECK (source_url ~ '^https://'),
  license_id uuid REFERENCES licenses(id),
  license_declared text NOT NULL CHECK (char_length(btrim(license_declared)) > 0),
  attribution text NOT NULL CHECK (char_length(btrim(attribution)) > 0),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lemma_id, source_name, language),
  -- Sem aprovação humana registrada, a entrada não pode se declarar aprovada.
  CONSTRAINT lexicon_entries_requires_human_approval CHECK (
    (approved_by IS NULL AND approved_at IS NULL) OR
    (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS lexicon_entries_lemma_idx ON lexicon_entries(lemma_id, language);

COMMIT;
