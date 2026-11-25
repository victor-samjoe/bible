# Fontes de idiomas originais — Bíblia Bereana

**Estado:** as três fontes foram **coletadas e conferidas por checksum** (ver "Proveniência da coleta"). Em **19/11/2026**, Victor Filipe Conceição, proprietário do produto, aprovou formalmente: (1) SBLGNT para exibição do texto grego; (2) OSHB/MorphHB para exibição do texto hebraico, segmentação, lemas e códigos morfológicos publicados pela fonte; e (3) WLC/eBible apenas como evidência independente do texto-base em domínio público. A aprovação não inclui aparato crítico, glossa, tradução, Strong, transliteração, morfologia grega nem definição lexical. A importação íntegra e o status `approved` no banco foram confirmados na mesma data.

**Importação concluída em 19/11/2026:** as edições `SBLGNT` e `MORPHHB` foram gravadas no banco de produção e marcadas `approved` após conferência de 7.927/137.542 (versículos/tokens) e 23.213/306.785/471.674 (versículos/tokens/morfemas), respectivamente. A consulta pública continua limitada por seleção e sempre exibe atribuição.

## Princípio de separação

Texto-base, segmentação, lema/morfologia, glossário/definições, Strong's, transliteração e alinhamento são ativos independentes. A licença de um não autoriza automaticamente os demais. O leitor deve exibir somente o conjunto de ativos efetivamente aprovados e a origem da análise em cada painel de palavra.

## Candidatos confirmados documentalmente

| Fonte | Escopo proposto | Licença/evidência | Situação (atualizada em 2026-11-17) |
| --- | --- | --- | --- |
| [Westminster Leningrad Codex (WLC)](https://open.bible/bibles/westminster-leningrad-codex) | Texto hebraico do AT, vocalização massorética | A página do provedor o classifica como **Public Domain**, identifica Westminster Hebrew Institute/United Bible Societies e oferece USX/USFM/Word. | Coletado e conferido; aprovado somente como evidência independente. O texto exibido virá do MorphHB para não misturar digitalizações. |
| [Open Scriptures Hebrew Bible / MorphHB](https://github.com/openscriptures/morphhb) | Hebraico, segmentação, lema e morfologia | O `LICENSE.md` declara base WLC e **CC BY 4.0**. A atribuição pedida é: `Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb`. | **Aprovado e importado em 19/11/2026** para texto, segmentação, lema e código morfológico. |
| [SBL Greek New Testament (SBLGNT)](https://sblgnt.com/) | Texto grego koiné do NT | O site do SBLGNT declara **CC BY 4.0** e disponibiliza download; o contrato exige atribuição, link da licença, indicação de modificações e preservação de avisos aplicáveis. | **Aprovado e importado em 19/11/2026** somente para texto grego; aparato e morfologia continuam fora. |

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

## Proveniência da coleta (tarefa C14)

Os bytes oficiais ficam em `data/sources/originals/<id>/`, que o `.gitignore`
mantém **fora do Git e fora do bundle**. Como os `MANIFEST.json` também não são
versionados, o registro de proveniência exigido pela tarefa fica aqui, em arquivo
versionado. Coleta em **2026-11-17** (`collected_at` `2026-11-17T22:44:57.379Z`).

| Fonte | Ativo que fornece | Versão fixada | Licença declarada |
| --- | --- | --- | --- |
| `wlc-ebible` | texto hebraico (evidência de domínio público do texto-base) | pacote USFM corrente do eBible na data da coleta — **sem tag**, fixado só pelo SHA-256 | Domínio público, declarado pela fonte |
| `oshb-morphhb` | texto + segmentação, lema e morfologia hebraicos | tag `v.2.2`, commit `6a5db284c715c18b239422e57bb89684e6a19f00` | CC BY 4.0 (base WLC) |
| `sblgnt` | texto grego do NT | arquivos correntes de `sblgnt.com/download` na data da coleta — **sem tag**, fixados só pelo SHA-256 | CC BY 4.0 |

### Checksums verificados

Reconferidos byte a byte em 2026-11-17 contra os manifestos: **32 de 32 arquivos
conferem** (2 arquivos compactados, 3 evidências de licença e os 27 arquivos de
texto do SBLGNT).

| Arquivo | SHA-256 |
| --- | --- |
| `wlc-ebible/hebwlc_usfm.zip` | `7c28c57832c0a1ed3a5c35604c7a99c3fb76b99294466cff3ac3ef0a08838fd3` |
| `wlc-ebible/EVIDENCIA-LICENCA.html` | `4feb87b2f89ff4c34457d5c7957e2cf20798a3573e4797b07985fb45dd3e2e2d` |
| `oshb-morphhb/morphhb-v.2.2.tar.gz` | `e8646225bccd145d8cb899eadf6edd705102ce6f39d1459175721d36863758c8` |
| `oshb-morphhb/LICENSE.md` | `9bf4a2890c25372e4c1dc750d550bfb4eacfbfcb63c53123b0628159370d1878` |
| `sblgnt/LICENCA.html` | `837f5a5e3f0454134aae2e95141b4d8b887cdc6c8e536bf2fe204d5b7ad4ad75` |

Os 27 SHA-256 dos arquivos de texto do SBLGNT ficam em
`data/sources/originals/sblgnt/MANIFEST.json`, com a URL oficial de cada um, e
são reconferidos por `scripts/verify-original-corpus.ts`.

### Limitação de versionamento, registrada de propósito

WLC (eBible) e SBLGNT (sblgnt.com) são servidos como **arquivos correntes, sem
release nem tag**. Logo, o único pino real dessas duas é o SHA-256 acima: se a
fonte republicar o arquivo, o checksum deixa de conferir e a verificação falha
fechada — o que é o comportamento desejado, mas significa que não existe como
rebaixar para uma versão anterior pela própria fonte. Só o MorphHB tem tag e
commit verdadeiros.

### Qual digitalização do WLC está em uso

O texto hebraico que os importadores leem vem do **OSIS do MorphHB**, não do USFM
do eBible. Os dois são digitalizações do mesmo códice; misturá-las sob o mesmo
rótulo produziria texto de procedência ambígua. O pacote do eBible fica guardado
como evidência independente de que o texto-base é de domínio público.

## Fontes consultadas

- [Open.Bible — WLC](https://open.bible/bibles/westminster-leningrad-codex)
- [eBible — WLC e formatos](https://ebible.org/bible/details.php?id=hebwlc)
- [Open Scriptures MorphHB — licença](https://github.com/openscriptures/morphhb/blob/master/LICENSE.md)
- [SBLGNT — página oficial](https://sblgnt.com/)
- [SBLGNT — licença CC BY 4.0](https://sblgnt.com/license/)

