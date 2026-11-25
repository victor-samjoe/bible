# Pipeline lexical — índice validado localmente (LEXICON-INDEX-001 / fila C30)

Atualizado em **19/11/2026**. Documenta o registro versionado das fontes, a coleta por commit e
checksum, os parsers, o modelo normalizado e os portões operacionais restantes.

**Estado honesto, em uma frase:** quatro fontes do MVP foram coletadas, conferidas e indexadas;
o banco descartável recebeu a migration e a carga completa. Produção segue intocada.

---

## 1. O que esta frente entrega e o que não entrega

| Entregue | Não entregue |
| --- | --- |
| Registro versionado das fontes, com licença, atribuição, campos selecionados e proibidos | Aplicação de migration/importação em produção |
| Coletor que falha fechado em hash divergente e grava só em diretório ignorado | Tradução pt-BR sem revisão humana |
| Verificador offline de checksum, invariantes e parse | Alinhamento automático de uma tradução portuguesa |
| Parsers determinísticos com proveniência por campo e índice integral | Parser do `BrownDriverBriggs.xml` |
| Contrato do fluxo editorial de tradução pt-BR | Qualquer tradução gerada ou publicada |
| Fixtures e testes de Gênesis 1:1 e João 1:1 | Publicação da consulta integral em produção |

A prova revisada de Gênesis 1:1 permanece como prioridade editorial. O leitor passou a consultar
`/api/biblia/lexico` progressivamente: sem índice naquele ambiente, o texto original continua
funcionando e nenhuma definição é inventada.

## 2. Pinos, hashes e coleta concluídos

As quatro fontes do MVP têm commit de 40 hex, caminhos confirmados e SHA-256 por ativo no
registro. Os bytes ficam somente em `data/sources/lexicons/`, ignorados pelo Git; os manifestos
locais registram a data da coleta, URL pinada, licença e tamanho de cada arquivo.

`scripts/verify-lexicon-sources.ts` conferiu todos os hashes e o formato real. Resultado:

- MACULA Hebrew: 469.476 ocorrências;
- MACULA Greek: 137.741 ocorrências;
- Open Scriptures HebrewLexicon: 8.674 verbetes e 10.212 ligações lema→Strong/BDB;
- STEPBible TBESG: 10.847 verbetes.

O artefato normalizado contém 19.521 verbetes e 607.217 ocorrências. A carga foi executada em
Postgres descartável e confirmou a cobertura de 23.213 versículos hebraicos e 7.939 gregos.

## 3. Fontes no registro

| id | Ativo | Licença declarada | Importável | Estado da coleta |
| --- | --- | --- | --- | --- |
| `macula-hebrew` | anotação por ocorrência (hebraico) | CC BY 4.0 | sim | aguarda aprovação |
| `macula-greek` | anotação por ocorrência (grego) | CC BY 4.0 | sim | aguarda aprovação |
| `oshb-hebrewlexicon` | verbete hebraico (BDB + Strong) | CC BY 4.0; textos históricos em domínio público | sim | aguarda aprovação |
| `stepbible-tbesg` | verbete grego breve | CC BY 4.0 | sim | aguarda aprovação |
| `stepbible-tflsj` | verbete grego aprofundado (LSJ) | CC BY 4.0 | sim, mas sem ativo declarado | fora do MVP |
| `stepbible-tbesh` | verbete hebraico | ressalva de permissão | **não** | **bloqueada** |
| `clear-bible-alignments` | referência de formato | dados CC BY 4.0, código MIT | **não** | nada é importado |

### Separação de papéis

MACULA responde **que sentido a palavra assume nesta ocorrência**; o verbete responde **o que a
palavra pode significar**. São ativos distintos e ficam em tabelas distintas: a ocorrência guarda
forma, morfologia, referência e sentido anotado, e aponta para o verbete por chave. O verbete é
importado **uma vez por lema** e reutilizado em todas as ocorrências — é exatamente o que
`LEXICON-INDEX-001` exige e o que a prova manual de hoje não faz.

### O texto original não muda de fonte

Hebraico continua vindo do MorphHB e grego do SBLGNT, ambos já aprovados e importados em
19/11/2026. MACULA entra como **anotação** sobre esse texto, não como novo texto-base. Misturar
digitalizações sob o mesmo rótulo é o erro que `docs/ORIGINAL_LANGUAGE_SOURCES.md` já documenta
para o WLC.

## 4. A proibição do `Meaning` do TBESH

**Nenhum campo do TBESH é importado, e a coluna `Meaning` é proibida por nome.**

O cabeçalho do próprio TBESH distingue duas colunas: `Gloss`, criada pelos estudiosos da Tyndale
House, e `Meaning`, derivada do *Abridged BDB* publicado pelo Online Bible, para a qual o cabeçalho
pede que se **obtenha permissão** antes de reutilizar em outro projeto. O CC BY 4.0 do pacote não
resolve isso: quem licencia o pacote não é o titular daquele texto específico, e uma licença só
pode conceder direitos que o licenciante tem.

Por isso:

- `stepbible-tbesh` está no registro com `importable: false`, `collectionStatus: "blocked"` e
  `license.family: "permission-required"`;
- `prohibitedFields` lista `Meaning` com o motivo completo e o link da evidência;
- `mapColumns()` **interrompe a leitura** se encontrar a coluna, em vez de ignorá-la — campo
  proibido é erro, não omissão;
- `assertNoLicenseMixing()` recusa qualquer tentativa de marcar como importável uma fonte cuja
  família de licença seja `permission-required`;
- a definição hebraica vem do **Open Scriptures HebrewLexicon**, que não arrasta essa pendência.

A fonte permanece registrada de propósito. Uma fonte proibida que some do registro é uma fonte que
alguém reintroduz daqui a seis meses sem saber por que ela saiu.

### Mistura de licença

CC BY 4.0 e CC BY-SA 4.0 **não convivem** no conjunto importado: o share-alike contaminaria o
derivado inteiro, mudando as obrigações sobre todo o léxico. É decisão jurídica, não técnica, e por
isso está no código: `assertNoLicenseMixing()` lança erro se as duas famílias aparecerem juntas.
É o que mantém unfoldingWord UHAL/UGL (CC BY-SA 4.0) fora do núcleo, como
`docs/LEXICON_SOURCE_RECOMMENDATION.md` já recomendava.

## 5. Proveniência por campo, não por registro

Um mesmo verbete pode receber a transliteração de uma fonte e a definição de outra. Guardar uma
única linha de crédito no registro inteiro tornaria a atribuição imprecisa justamente onde a
licença exige precisão. Cada valor normalizado carrega:

```text
sourceId · assetPath · pin · assetSha256 · licenseDeclared · attribution · sourceField
```

`sourceField` é o nome exato da coluna/elemento lido. Isso permite responder, por campo exibido na
tela, de qual arquivo, de qual commit e sob qual licença ele veio.

## 6. Parsers guiados pelo cabeçalho real

MACULA e STEPBible mudam nomes e ordem de colunas entre revisões. Fixar índice de coluna no código
importaria a coluna errada no dia em que a fonte inserisse outra no meio — e coluna errada, aqui,
pode ser coluna de licença diferente. Por isso o mapeamento vem do cabeçalho do arquivo, cruzado
com `selectedFields`:

- coluna declarada → lida;
- coluna não declarada → **ignorada** e devolvida em `ignoredFields` para auditoria;
- coluna proibida → **leitura interrompida**;
- coluna exigida ausente → **leitura interrompida** (o formato mudou ou o arquivo não é o esperado).

**Aviso importante:** os nomes de coluna e os caminhos de arquivo no registro foram escritos a
partir da documentação pública das fontes e **não foram conferidos contra os bytes reais**, porque
a coleta não aconteceu. `pathConfirmed` é `false` em todos os ativos justamente por isso. Se um
nome estiver diferente, a primeira execução do verificador falha fechada dizendo qual coluna falta
— que é o comportamento desejado, e não um dado errado importado em silêncio.

### `BrownDriverBriggs.xml` não é lido

O BDB é uma árvore de sentidos aninhados; achatá-la para caber no modelo plano atual perderia a
hierarquia que é o valor da obra. O ativo fica declarado com `readerStatus: "pending_parser"`, para
que a falta apareça no verificador em vez de passar por omissão. Parser próprio em tarefa separada.

## 7. Tradução para português

As fontes estão em inglês. A versão portuguesa é **ativo derivado**, nunca sobrescreve o original e
tem três estados:

| Estado | Significado | Publicável |
| --- | --- | --- |
| `machine_draft` | rascunho gerado em lote, com método declarado | não |
| `human_reviewed` | revisado por pessoa nomeada, com data | não |
| `approved` | aprovado para exibição | sim |

Transições permitidas: `machine_draft → human_reviewed → approved`, mais `reject` (volta ao
rascunho) e `reopen` (derruba o aprovado para revisão). **`machine_draft → approved` não existe**:
pular a revisão é o único jeito de um texto de máquina chegar ao leitor como se fosse verbete
conferido.

Enquanto não houver tradução aprovada, o leitor mostra a glossa original com o idioma indicado, ou
"dados lexicais ainda não disponíveis" — nunca um rascunho.

**Esta frente não gerou nenhuma tradução.** `assertNoTranslationsProduced()` existe para garantir
isso no pipeline de preparação, e o campo `translations` dos verbetes normalizados é tipado como
`readonly never[]`.

## 8. Arquivos

| Papel | Arquivo |
| --- | --- |
| Registro versionado das fontes | `src/domain/lexicon/source-registry.ts` |
| Modelo normalizado e proveniência | `src/domain/lexicon/records.ts` |
| Fluxo editorial de tradução | `src/domain/lexicon/translation-workflow.ts` |
| Leitor de tabelas guiado por cabeçalho | `src/importers/lexicon/delimited.ts` |
| Parser MACULA (ocorrências) | `src/importers/lexicon/macula.ts` |
| Parser STEPBible (verbetes) | `src/importers/lexicon/stepbible.ts` |
| Parser Open Scriptures HebrewLexicon | `src/importers/lexicon/oshb-hebrew-lexicon.ts` |
| Coleta | `scripts/fetch-lexicon-sources.ts` |
| Verificação offline | `scripts/verify-lexicon-sources.ts` |
| Montagem do índice (sem banco) | `scripts/build-lexicon-index.ts` |
| Fixtures offline | `tests/fixtures/lexicons/` |
| Testes | `tests/domain/lexicon-registry.test.ts`, `tests/domain/lexicon-translation-workflow.test.ts`, `tests/importers/lexicon-sources.test.ts` |

Bytes e manifestos de coleta ficam em `data/sources/lexicons/` e o índice montado em
`data/generated/lexicons/` — os dois **ignorados pelo Git**, como já acontece com
`data/sources/originals/`.

### Sobre as fixtures

Lema, transliteração, código Strong e referência canônica são dados factuais e aparecem como são.
**Glossa e definição nas fixtures são textos sintéticos**, escritos como `glossa-fixture-G3056` e
`definicao-fixture-H7225` de propósito: nenhum teste finge conhecer o verbete real de uma fonte que
não foi baixada.

## 9. Comandos

```bash
# Plano de coleta. Não baixa nada.
node --experimental-strip-types scripts/fetch-lexicon-sources.ts

# Verificação offline: invariantes do registro + checksum e parse do que existir localmente.
node --experimental-strip-types scripts/verify-lexicon-sources.ts

# Montagem do índice normalizado, sem banco. --emit grava em data/generated/lexicons/.
node --experimental-strip-types scripts/build-lexicon-index.ts
node --experimental-strip-types scripts/build-lexicon-index.ts --emit

# Importação: exige DATABASE_URL explícita e só deve mirar produção após ordem operacional.
DATABASE_URL=... node --experimental-strip-types scripts/import-lexicon-index.ts --dry-run
DATABASE_URL=... node --experimental-strip-types scripts/import-lexicon-index.ts

# Testes desta frente.
npx vitest run tests/domain/lexicon-registry.test.ts
npx vitest run tests/domain/lexicon-translation-workflow.test.ts
npx vitest run tests/importers/lexicon-sources.test.ts
npx vitest run tests/server/lexicon-reader.test.ts
npm run typecheck
```

## 10. Portões abertos, em ordem

1. **Aplicação remota** de `0008` e execução do importador contra a conexão de produção — exige
   ordem operacional explícita; não foi feita nesta frente.
2. **Revisão editorial pt-BR**: texto de máquina não é publicável. Até haver aprovação, a API
   mostra apenas a glossa na língua-fonte, identificada como tal.
3. **Alinhamento por versão**: a ligação entre palavras portuguesas e originais continua uma fila
   editorial separada; o leitor não deve inferi-la por posição.
4. **BDB hierárquico**: `BrownDriverBriggs.xml` está coletado mas deliberadamente sem parser plano.

## 11. Fontes consultadas

- https://github.com/Clear-Bible/macula-hebrew
- https://github.com/Clear-Bible/macula-greek
- https://github.com/Clear-Bible/Alignments
- https://github.com/openscriptures/HebrewLexicon
- https://github.com/STEPBible/STEPBible-Data
- https://github.com/STEPBible/STEPBible-Data/tree/master/Lexicons

As fontes foram coletadas dos commits declarados no registro e suas licenças, caminhos e hashes
foram conferidos pelo verificador local.
