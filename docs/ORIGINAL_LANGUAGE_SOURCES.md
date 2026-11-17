# Fontes de idiomas originais — Bíblia Bereana

**Estado:** pesquisa documental; nenhuma fonte abaixo está marcada como importada ou aprovada para produção. Antes de baixar/importar, registrar URL exata, release/tag, data, licença copiada, checksum SHA-256 dos bytes e revisor humano.

## Princípio de separação

Texto-base, segmentação, lema/morfologia, glossário/definições, Strong's, transliteração e alinhamento são ativos independentes. A licença de um não autoriza automaticamente os demais. O leitor deve exibir somente o conjunto de ativos efetivamente aprovados e a origem da análise em cada painel de palavra.

## Candidatos confirmados documentalmente

| Fonte | Escopo proposto | Licença/evidência | Situação |
| --- | --- | --- | --- |
| [Westminster Leningrad Codex (WLC)](https://open.bible/bibles/westminster-leningrad-codex) | Texto hebraico do AT, vocalização massorética | A página do provedor o classifica como **Public Domain**, identifica Westminster Hebrew Institute/United Bible Societies e oferece USX/USFM/Word. | Candidato para texto; ainda requer pin de arquivo e checksum. |
| [Open Scriptures Hebrew Bible / MorphHB](https://github.com/openscriptures/morphhb) | Hebraico, segmentação, lema e morfologia | O `LICENSE.md` declara base WLC e **CC BY 4.0**. A atribuição pedida é: `Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb`. | Candidato para dados linguísticos do AT; não importar sem release/tag fixado. |
| [SBL Greek New Testament (SBLGNT)](https://sblgnt.com/) | Texto grego koiné do NT | O site do SBLGNT declara **CC BY 4.0** e disponibiliza download; o contrato exige atribuição, link da licença, indicação de modificações e preservação de avisos aplicáveis. | Candidato para texto do NT; não inclui, por si só, licença de léxico/morfologia. |

### Atribuições de produto

- **WLC:** apresentar no catálogo de fontes como `Westminster Leningrad Codex (WLC), texto em domínio público; fonte digital identificada no manifesto da versão importada.` Não atribuir a terceiros sem o aviso que vier no pacote específico.
- **OSHB/MorphHB:** apresentar a frase de atribuição exigida acima, linkar a fonte e CC BY 4.0; indicar normalizações/alterações feitas pela Bíblia Bereana.
- **SBLGNT:** conservar criador(es)/detentores e avisos fornecidos no pacote, linkar o material e [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), e indicar modificações/normalizações. Não sugerir endosso de SBL, Logos/Faithlife ou Michael W. Holmes.

## O que ainda não está liberado por esta pesquisa

1. Definições em português, glossários, domínios semânticos, Strong's, transliterações e exemplos não são automaticamente cobertos por WLC, OSHB ou SBLGNT.
2. Morfologia do NT precisa de fonte própria, com licença e atribuição próprias; até isso, o painel grego pode mostrar somente texto/referência do SBLGNT aprovado, sem fabricar parsing.
3. Aparato crítico, variantes, notas editoriais e traduções modernas são ativos separados.
4. Não aplicar DRM/termos que impeçam o exercício da CC BY sobre o próprio material licenciado; proteção de conta pode proteger dados pessoais e recursos próprios, não revogar direitos concedidos pela licença do corpus.

## Procedimento de ingestão e proveniência

1. Registrar fonte, URL de download, tag/release/commit, versão declarada, licença copiada e data de coleta.
2. Baixar somente o artefato oficial; preservar bytes imutáveis privados e calcular SHA-256.
3. Extrair em processo versionado; gravar parser, versão de Unicode/normalização, contagens de livros/capítulos/versículos/palavras e erros.
4. Validar versificação e âncoras contra manifesto da fonte; não inferir correspondências entre traduções por posição.
5. Publicar apenas depois da revisão de direitos, integridade, atribuição e amostras de palavras/versículos.

## Modelo de dados recomendado

As chaves abaixo são conceituais; uma migration só deve existir após aprovação da fonte e do desenho de produto.

```text
original_editions(id, code, language, corpus, version, source_url, license_id,
                  attribution, source_sha256, imported_at, status)
original_verses(id, edition_id, canon_book, chapter, verse, text, canonical_ref)
original_tokens(id, verse_id, position, surface, normalized, start_offset, end_offset,
                direction, source_token_id)
original_morphemes(id, token_id, position, surface, lemma_id, morphology_code,
                   source_morpheme_id)
lemmas(id, language, lemma, strong_id_nullable, transliteration_nullable,
       source_id, source_version)
lexicon_entries(id, lemma_id, language, definition, gloss, source_id, license_id,
                attribution, status)
translation_alignment(id, original_verse_id, translation_verse_id, method,
                      confidence, source_id, status)
reading_annotations(id, user_id, translation_verse_id, token_range, color,
                    note_ciphertext, created_at, updated_at)
reading_progress(id, user_id, translation_edition_id, canonical_ref, completed_at)
```

`token_range` deve referir offsets/versionamento do texto exibido, não texto livre. Notas são privadas por padrão; dados religiosos e de leitura não entram em logs analíticos.

## Gates para a ferramenta de palavra

- Edição original aprovada, com hash e atribuição exibível.
- Tokenização/morfologia aprovada por release e teste de alinhamento; cada popup conserva `edition_id`, `token_id` e origem.
- Lema/definição só aparece se a fonte lexical específica estiver aprovada; ausência mostra `dados lexicais ainda não disponíveis`, não uma definição gerada por IA.
- Contexto produzido por IA é rotulado como tal, com fontes, escopo e possibilidade de erro; nunca apresentado como tradução ou dado filológico primário.
- Busca, notas, cores e progresso exigem identidade autenticada para sincronização; sem login, somente armazenamento local explícito.
- Auditoria confirma direitos, checksum, atribuição, versificação e amostra de UI antes de liberar cada idioma/versão.

## Fontes consultadas

- [Open.Bible — WLC](https://open.bible/bibles/westminster-leningrad-codex)
- [eBible — WLC e formatos](https://ebible.org/bible/details.php?id=hebwlc)
- [Open Scriptures MorphHB — licença](https://github.com/openscriptures/morphhb/blob/master/LICENSE.md)
- [SBLGNT — página oficial](https://sblgnt.com/)
- [SBLGNT — licença CC BY 4.0](https://sblgnt.com/license/)

