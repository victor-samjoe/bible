-- C30 — acepções do Brown-Driver-Briggs e domínios semânticos do MACULA.
--
-- Aditiva e idempotente: não altera, recria nem renomeia nada de 0000–0009.
-- NÃO aplicar em Supabase remoto sem autorização operacional explícita.
--
-- Responde à pergunta "como mostrar formas diversas de interpretação de uma
-- palavra" com o material que já está coletado, sob licença conferida, em vez
-- de buscar tradução de procedência desconhecida na internet.
--
-- Duas coisas entram aqui:
--
--  1. **A árvore de sentidos do BDB.** 11.845 verbetes e 8.989 sentidos,
--     aninhados até cinco níveis. `אָב` traz nove acepções de primeiro nível;
--     `הָיָה` traz 32 em cinco níveis, organizadas por tronco verbal.
--  2. **Os domínios semânticos do MACULA** que estavam sendo descartados:
--     `sdbh` (244.727 ocorrências) nomeia a acepção que a palavra assume
--     naquele versículo, e `lexdomain` (244.714) dá o domínio lexical. O
--     `coredomain`, que já era importado, cobre só 160.923 e informa a
--     categoria estável do lema, não o sentido local.
--
-- A árvore vai como `jsonb` em uma linha por verbete, e não como tabela de
-- adjacência, por três razões: ela é sempre lida inteira (o painel mostra as
-- acepções da palavra clicada, não uma folha isolada); a ordem dos irmãos é
-- parte do dado e uma tabela exigiria coluna de ordenação redundante; e são
-- 11.845 linhas, não 607 mil, então o argumento de volume que levou os
-- capítulos para `jsonb` na 0009 não se aplica — aqui a escolha é de forma, não
-- de tamanho.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Domínios semânticos por ocorrência.
-- ---------------------------------------------------------------------------

ALTER TABLE lexeme_occurrences
  ADD COLUMN IF NOT EXISTS sdbh_sense text,
  ADD COLUMN IF NOT EXISTS lexical_domain text;

-- ---------------------------------------------------------------------------
-- 2. Verbetes do BDB.
--
--    A chave é o id da obra (`a.ae.ab`), e não o Strong: o BDB organiza por
--    raiz e seção, e mais de um Strong pode cair no mesmo verbete. Tentar
--    chavear por Strong perderia verbete ou inventaria duplicata.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lexeme_bdb_entries (
  bdb_id text PRIMARY KEY CHECK (bdb_id ~ '^[a-z]+(\.[a-z]+)+$'),
  lemma text NOT NULL CHECK (char_length(btrim(lemma)) > 0),
  part_of_speech text,
  -- `type="root"` na fonte: o verbete é a raiz, não uma forma derivada.
  is_root boolean NOT NULL DEFAULT false,
  -- Definições do topo do verbete, antes de qualquer sentido. Separá-las dos
  -- sentidos evita que a definição geral apareça duplicada como acepção 1.
  definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Árvore recursiva: [{ number, stem, definitions[], note, children[] }].
  senses jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Contadores materializados: a alternativa seria uma função recursiva sobre
  -- o jsonb a cada leitura, só para dizer quantas acepções o verbete tem.
  sense_count integer NOT NULL CHECK (sense_count >= 0),
  max_depth integer NOT NULL CHECK (max_depth >= 0),
  provenance_id bigint NOT NULL REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Árvore e contagem precisam concordar: `sense_count` zero com `senses`
  -- preenchido significa que a contagem não foi recalculada na importação.
  -- O guarda de tipo vem dentro de cada CHECK porque o Postgres não garante a
  -- ordem de avaliação: sem ele, `senses` recebendo um objeto falha com
  -- "cannot get array length of a non-array" em vez de apontar a constraint
  -- nomeada, e quem estiver depurando a importação perde a pista.
  CONSTRAINT lexeme_bdb_entries_count_matches_tree CHECK (
    jsonb_typeof(senses) <> 'array'
      OR (jsonb_array_length(senses) = 0) = (sense_count = 0)
  ),
  CONSTRAINT lexeme_bdb_entries_depth_matches_tree CHECK (
    jsonb_typeof(senses) <> 'array'
      OR (jsonb_array_length(senses) = 0) = (max_depth = 0)
  ),
  CONSTRAINT lexeme_bdb_entries_senses_is_array CHECK (jsonb_typeof(senses) = 'array'),
  CONSTRAINT lexeme_bdb_entries_definitions_is_array CHECK (jsonb_typeof(definitions) = 'array')
);

CREATE INDEX IF NOT EXISTS lexeme_bdb_entries_lemma_idx ON lexeme_bdb_entries(lemma);

-- ---------------------------------------------------------------------------
-- 3. A ponte, que é o que torna o BDB alcançável.
--
--    Sem ela o BDB seria um dicionário que ninguém atinge: a ocorrência traz o
--    Strong, não o id do BDB. `LexicalIndex.xml` faz a tradução, e as 10.212
--    ligações são gravadas aqui. Sem chave estrangeira para `lexeme_entries`
--    pelo mesmo motivo de `lexeme_occurrences`: há Strong aumentado sem
--    verbete de Strong correspondente.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lexeme_bdb_links (
  lexeme_key text NOT NULL CHECK (char_length(btrim(lexeme_key)) > 0),
  bdb_id text NOT NULL REFERENCES lexeme_bdb_entries(bdb_id) ON DELETE RESTRICT,
  -- Lema aumentado como o MorphHB o publica, que é a terceira ponta da ponte.
  augmented_lemma text NOT NULL CHECK (char_length(btrim(augmented_lemma)) > 0),
  provenance_id bigint NOT NULL REFERENCES lexicon_provenance(id) ON DELETE RESTRICT,
  PRIMARY KEY (lexeme_key, bdb_id)
);

CREATE INDEX IF NOT EXISTS lexeme_bdb_links_bdb_idx ON lexeme_bdb_links(bdb_id);

COMMIT;
