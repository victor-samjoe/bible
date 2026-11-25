-- C30 — índice lexical e tradução editorial.
--
-- Aditiva e idempotente: não altera, recria nem renomeia nada de 0000–0007.
-- NÃO aplicar em Supabase remoto sem autorização operacional explícita.
--
-- Por que tabelas novas em vez de preencher `lexicon_entries` da 0005:
-- aquela tabela amarra cada definição a uma `original_edition`, porque foi
-- desenhada para definição que acompanha uma digitalização do texto-base. O
-- índice desta frente é o oposto — o verbete é **independente da tradução e da
-- edição** e é indexado por Strong, que é o que MACULA, OSHB e STEPBible têm em
-- comum. Forçá-lo no formato antigo exigiria inventar uma edição artificial
-- para cada fonte lexical. A 0005 continua válida e intocada para o caso dela.
--
-- O que o banco recusa, por construção:
--
--  * fonte lexical sem licença, atribuição e commit de 40 hex — sem pino, a
--    proveniência não identifica a versão de que o dado saiu;
--  * fonte marcada como aprovada para coleta sem quem aprovou e quando;
--  * campo importado sem proveniência: a licença exige crédito por campo, e
--    uma única linha de crédito por registro seria imprecisa onde a
--    transliteração vem de uma fonte e a definição de outra;
--  * tradução que se declare revisada ou aprovada sem revisor nomeado e data;
--  * passagem direta de rascunho a aprovado, que é o único caminho por onde um
--    texto de máquina chegaria ao leitor como verbete conferido;
--  * rebaixamento silencioso de um texto aprovado de volta a rascunho.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lexicon_collection_status') THEN
    CREATE TYPE lexicon_collection_status AS ENUM (
      'awaiting_owner_approval',
      'approved_for_collection',
      'blocked'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_status') THEN
    -- Espelha TRANSLATION_STATUSES de src/domain/lexicon/translation-workflow.ts.
    CREATE TYPE translation_status AS ENUM ('machine_draft', 'human_reviewed', 'approved');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Fontes: o registro versionado, gravado no banco para poder ser auditado
--    sem abrir o repositório.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lexicon_sources (
  id text PRIMARY KEY CHECK (char_length(btrim(id)) > 0),
  name text NOT NULL CHECK (char_length(btrim(name)) > 0),
  repository text NOT NULL CHECK (repository ~ '^https://'),
  -- Commit exato de 40 hex. `main` baixaria coisa diferente a cada dia e
  -- tornaria o SHA-256 dos ativos inútil como pino.
  pin_commit text NOT NULL CHECK (pin_commit ~ '^[0-9a-f]{40}$'),
  license_declared text NOT NULL CHECK (char_length(btrim(license_declared)) > 0),
  license_url text NOT NULL CHECK (license_url ~ '^https://'),
  attribution text NOT NULL CHECK (char_length(btrim(attribution)) > 0),
  collection_status lexicon_collection_status NOT NULL,
  approved_by text,
  approved_at date,
  approval_scope text,
  registry_version text NOT NULL CHECK (char_length(btrim(registry_version)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Aprovada para coleta exige decisão registrada: quem, quando e o quê.
  CONSTRAINT lexicon_sources_approval_is_named CHECK (
    collection_status <> 'approved_for_collection' OR (
      approved_by IS NOT NULL AND btrim(approved_by) <> '' AND
      approved_at IS NOT NULL AND
      approval_scope IS NOT NULL AND btrim(approval_scope) <> ''
    )
  )
);

-- ---------------------------------------------------------------------------
-- 2. Proveniência por campo, internada.
--
--    São 607 mil ocorrências e 19 mil verbetes saídos de 5 arquivos. Repetir o
--    bloco de crédito em cada linha multiplicaria o mesmo texto centenas de
--    milhares de vezes; aqui ele existe uma vez por (fonte, arquivo, campo) e
--    as linhas apontam para ele.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lexicon_provenance (
  id bigserial PRIMARY KEY,
  source_id text NOT NULL REFERENCES lexicon_sources(id) ON DELETE RESTRICT,
  asset_path text NOT NULL CHECK (char_length(btrim(asset_path)) > 0),
  asset_sha256 text NOT NULL CHECK (asset_sha256 ~ '^[0-9a-f]{64}$'),
  source_field text NOT NULL CHECK (char_length(btrim(source_field)) > 0),
  pin text NOT NULL CHECK (char_length(btrim(pin)) > 0),
  UNIQUE (source_id, asset_path, asset_sha256, source_field)
);

-- ---------------------------------------------------------------------------
-- 3. Verbete: o que a palavra **pode** significar. Uma linha por lema.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lexeme_entries (
  lexeme_key text PRIMARY KEY CHECK (char_length(btrim(lexeme_key)) > 0),
  language original_language NOT NULL,
  strong_id text,
  lemma text NOT NULL CHECK (char_length(btrim(lemma)) > 0),
  lemma_provenance_id bigint NOT NULL REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  transliteration text,
  transliteration_provenance_id bigint REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  part_of_speech text,
  gloss text,
  gloss_provenance_id bigint REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  definition text,
  definition_provenance_id bigint REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  etymology text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Campo presente exige proveniência; proveniência sem campo é crédito órfão.
  CONSTRAINT lexeme_entries_transliteration_has_provenance CHECK (
    (transliteration IS NULL) = (transliteration_provenance_id IS NULL)
  ),
  CONSTRAINT lexeme_entries_gloss_has_provenance CHECK (
    (gloss IS NULL) = (gloss_provenance_id IS NULL)
  ),
  CONSTRAINT lexeme_entries_definition_has_provenance CHECK (
    (definition IS NULL) = (definition_provenance_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS lexeme_entries_strong_idx
  ON lexeme_entries(language, strong_id);

-- ---------------------------------------------------------------------------
-- 4. Ocorrência: o que a palavra diz **aqui**.
--
--    `word_position` existe porque o MACULA Hebrew é morfêmico: `GEN 1:1!1` são
--    duas linhas, a preposição e o substantivo. São 11 morfemas para as 7
--    palavras que o leitor mostra, e é a posição que devolve "os morfemas da
--    palavra 3". `lexeme_key` **não** tem chave estrangeira para
--    `lexeme_entries`: 28% das ocorrências são prefixos e sufixos com Strong
--    aumentado ("0871a", "1886a") que o dicionário de Strong não define, e uma
--    FK obrigaria a inventar o verbete que falta ou a descartar o morfema.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lexeme_occurrences (
  source_word_id text PRIMARY KEY CHECK (char_length(btrim(source_word_id)) > 0),
  language original_language NOT NULL,
  canonical_ref text NOT NULL CHECK (canonical_ref ~ '^[A-Z0-9]{3} [0-9]+:[0-9]+$'),
  word_position integer CHECK (word_position IS NULL OR word_position > 0),
  surface text NOT NULL CHECK (char_length(btrim(surface)) > 0),
  lexeme_key text NOT NULL CHECK (char_length(btrim(lexeme_key)) > 0),
  lemma text NOT NULL CHECK (char_length(btrim(lemma)) > 0),
  morphology text,
  part_of_speech text,
  semantic_domain text,
  sense_number text,
  semantic_frame text,
  -- Glossa contextual em inglês: é o texto-fonte da tradução editorial.
  gloss text,
  provenance_id bigint NOT NULL REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lexeme_occurrences_ref_idx
  ON lexeme_occurrences(canonical_ref, word_position, source_word_id);

CREATE INDEX IF NOT EXISTS lexeme_occurrences_lexeme_idx
  ON lexeme_occurrences(lexeme_key);

-- ---------------------------------------------------------------------------
-- 5. Tradução editorial para pt-BR.
--
--    `subject` é a glossa (`gloss:hbo:in`) ou o lema (`hbo:H7225`), porque os
--    dois são traduzíveis e o fluxo de revisão é o mesmo. A glossa é traduzida
--    por **texto distinto**, não por ocorrência: 60 mil registros em vez de
--    607 mil, e a mesma palavra sai igual em todo o texto.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS editorial_translations (
  subject text NOT NULL CHECK (char_length(btrim(subject)) > 0),
  target text NOT NULL CHECK (char_length(btrim(target)) > 0),
  source_text text NOT NULL CHECK (char_length(btrim(source_text)) > 0),
  source_language text NOT NULL CHECK (source_language IN ('en', 'grc', 'hbo')),
  target_language text NOT NULL CHECK (target_language = 'pt-BR'),
  text text NOT NULL CHECK (char_length(btrim(text)) > 0),
  status translation_status NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  -- Como o rascunho nasceu, declarado honestamente.
  draft_method text NOT NULL CHECK (char_length(btrim(draft_method)) > 0),
  provenance_id bigint NOT NULL REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, target),
  -- Espelha assertTranslationIsCoherent: revisado ou aprovado exige revisor
  -- nomeado e data válida. Revisão sem revisor é a forma mais fácil de um
  -- rascunho virar "aprovado" por descuido.
  CONSTRAINT editorial_translations_review_is_named CHECK (
    status = 'machine_draft' OR (
      reviewed_by IS NOT NULL AND btrim(reviewed_by) <> '' AND reviewed_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS editorial_translations_status_idx
  ON editorial_translations(status, target);

-- Transições de estado, iguais às de `nextTranslationStatus`. A regra que
-- importa é a ausência de `machine_draft -> approved`: pular a revisão é o
-- único jeito de um texto de máquina chegar ao leitor como verbete conferido.
-- Um gatilho, e não um CHECK, porque a regra olha o valor **anterior**.
CREATE OR REPLACE FUNCTION editorial_translation_transition_is_allowed() RETURNS trigger AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'machine_draft' AND NEW.status = 'human_reviewed' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'human_reviewed' AND NEW.status IN ('approved', 'machine_draft') THEN
    RETURN NEW;
  END IF;
  -- Reabrir um texto aprovado o derruba para revisão, nunca para publicado nem
  -- direto para rascunho.
  IF OLD.status = 'approved' AND NEW.status = 'human_reviewed' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'transicao de traducao invalida: % -> %', OLD.status, NEW.status
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS editorial_translations_valid_transition ON editorial_translations;
CREATE TRIGGER editorial_translations_valid_transition
  BEFORE UPDATE ON editorial_translations
  FOR EACH ROW EXECUTE FUNCTION editorial_translation_transition_is_allowed();

COMMIT;
