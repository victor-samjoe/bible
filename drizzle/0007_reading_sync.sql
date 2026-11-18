-- Alinha os dados pessoais de leitura ao leitor que existe de fato.
--
-- A migration 0003 desenhou estas tabelas antes do leitor (tarefa C13) ficar
-- pronto, e as duas descricoes divergiram em tres pontos. Nenhuma linha existe
-- em producao, entao a correcao e direta.
--
--  1. Preferencias. O banco guardava `font_size smallint` e `line_height
--     numeric`, mas o leitor nao oferece numero: oferece escolhas nomeadas
--     ("medio", "amplo"). Guardar 18 e 1.70 obrigaria a inventar uma conversao
--     de ida e volta que nao e fiel ao que a pessoa escolheu. Alem disso a
--     fonte do leitor tem cinco opcoes, e o enum tinha tres, sem as duas que o
--     leitor realmente usa. Espacamento de paragrafo nao existia.
--
--     As colunas novas sao `text` com CHECK, e nao enum, de proposito: este e
--     vocabulario de interface, que muda quando o leitor ganha uma opcao. Enum
--     exige ALTER TYPE e migration para cada ajuste de produto; CHECK permite
--     evoluir com o mesmo cuidado e menos cerimonia.
--
--  2. Nota de varios versiculos. O leitor ancora a nota na selecao que a
--     originou, que pode ser `3-5,9` — intervalo com buraco. A tabela so tinha
--     `verse_id`, o que forcaria quebrar uma nota em varias ou mentir sobre o
--     alcance dela. Agora `verse_id` e a ancora (primeiro versiculo) e
--     `verse_list` guarda a selecao exata, no mesmo formato compactado que
--     `src/domain/reader-marks.ts` produz e valida.
--
--  3. Cor do destaque continua em ingles no banco, como o resto do schema, e a
--     traducao para o vocabulario do leitor fica em um mapa pequeno no codigo.
--     O valor 'purple' do enum segue sem uso: remover exigiria recriar o tipo,
--     e um valor nao usado nao custa nada.

ALTER TABLE reading_preferences
  DROP COLUMN font_family,
  DROP COLUMN font_size,
  DROP COLUMN line_height;

ALTER TABLE reading_preferences
  ADD COLUMN font_family text NOT NULL DEFAULT 'serif'
    CHECK (font_family IN ('serif', 'sans', 'literaria', 'humana', 'monospace')),
  ADD COLUMN font_size text NOT NULL DEFAULT 'medio'
    CHECK (font_size IN ('muito-pequeno', 'menor', 'pequeno', 'medio', 'grande')),
  ADD COLUMN line_spacing text NOT NULL DEFAULT 'padrao'
    CHECK (line_spacing IN ('continuo', 'compacto', 'padrao', 'amplo')),
  ADD COLUMN paragraph_spacing text NOT NULL DEFAULT 'padrao'
    CHECK (paragraph_spacing IN ('junto', 'padrao', 'separado'));

-- O leitor nao oferece "system": o tema e um botao de dois estados.
ALTER TABLE reading_preferences DROP CONSTRAINT IF EXISTS reading_preferences_theme_check;
UPDATE reading_preferences SET theme = 'dark' WHERE theme NOT IN ('light', 'dark');
ALTER TABLE reading_preferences
  ADD CONSTRAINT reading_preferences_theme_check CHECK (theme IN ('light', 'dark'));

-- O tipo so era usado pela coluna removida acima.
DROP TYPE IF EXISTS reading_font_family;

-- Selecao exata da nota, no formato de `compactVerseList`: "5", "3-5", "3-5,9".
ALTER TABLE verse_notes
  ADD COLUMN verse_list text NOT NULL DEFAULT ''
    CHECK (verse_list ~ '^[0-9]{1,3}(-[0-9]{1,3})?(,[0-9]{1,3}(-[0-9]{1,3})?)*$');
ALTER TABLE verse_notes ALTER COLUMN verse_list DROP DEFAULT;

-- Uma nota por selecao exata: reescrever a nota de "3-5" atualiza a mesma
-- linha, enquanto uma nota nova em "3-5,9" e outra anotacao, nao a mesma.
ALTER TABLE verse_notes
  ADD CONSTRAINT verse_notes_owner_selection_unique UNIQUE (user_id, verse_id, verse_list);
