-- C30 — distribuição compacta do índice lexical.
--
-- O índice relacional completo é útil para curadoria/offline, mas suas 607 mil
-- ocorrências ocupam ~290 MB com índices. Em produção, os dados são públicos,
-- imutáveis e sempre consultados por capítulo. Este formato guarda um payload
-- compacto por livro/capítulo; o TOAST do Postgres o comprime e evita consumir
-- o limite do plano com valores e índices repetidos.

BEGIN;

CREATE TABLE IF NOT EXISTS lexicon_chapter_shards (
  language original_language NOT NULL,
  book_code text NOT NULL CHECK (book_code ~ '^[A-Z0-9]{3}$'),
  chapter integer NOT NULL CHECK (chapter > 0 AND chapter <= 150),
  payload jsonb NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (language, book_code, chapter)
);

COMMIT;
