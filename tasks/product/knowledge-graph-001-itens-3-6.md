# KNOWLEDGE-GRAPH-001 — itens 3 a 6 da fila do grafo

**Fila:** `tasks/product/CLAUDE2_FILA_GRAFO_NOITE.md`.
**Data:** 25/11/2026.
**Antecede:** `knowledge-graph-001-itens-1-2.md`.

---

## Item 3 — referências e revisão

### Defeito encontrado e corrigido: identidade de fonte trocada em silêncio

Todo índice da frente era montado com `new Map(lista.map(...))`, construção em
que **o último vence sem aviso**. Duas edições com o mesmo identificador — uma
importação repetida, uma junção malfeita, duas linhas de um banco sem restrição
de unicidade — e a segunda substituía a primeira.

Entre uma edição em domínio público e outra que exige permissão, **a ordem das
linhas passava a decidir se o conteúdo era exibido**. Uma citação podia sair
atribuída à edição errada, com a licença errada, e a árvore não tinha como
notar. Era a troca silenciosa de identidade de fonte que a fila mandava procurar.

Correção: `rejectDisputedIds` em `tree.ts`, aplicada aos oito grupos de
registros antes de qualquer índice ser montado. Identificador disputado derruba
**todos** os registros que o disputam, e a recusa é declarada em `withheld`.

Falha fechado, e o motivo é simples: escolher o último seria servir a fonte
errada em metade dos casos, sem registro de que houve escolha. Na dúvida sobre
qual é a fonte, não se serve nenhuma.

A função usada para detectar é `duplicateIds`, de `primitives.ts` — um dos dez
exports que eu havia listado como mortos e recomendado apagar. **Estava morto
porque faltava o chamador, não porque fosse inútil.** Retiro a recomendação
sobre ele.

Prova em `tests/server/knowledge-graph-identity.test.ts` (7 testes). Antes da
correção, **5 dos 7 falhavam**. O teste decisivo é "não deixa a ordem das linhas
decidir a licença": projeta a mesma consulta com as duas edições em ordem
direta e invertida e exige resultado idêntico.

### Cadeia do testemunho e retratação

`tests/domain/knowledge-graph-references.test.ts` (12 testes) cobre o que a fila
pediu, e tudo já passava — a camada estava correta aqui:

- testemunho exigido e ausente no ramo que o declara obrigatório;
- testemunho fora do índice;
- **edição intermediária ausente** — o testemunho existe, mas a edição por onde
  sua leitura é conhecida não está registrada, e sem ela o registro sugere
  acesso direto ao manuscrito;
- testemunho informado em ramo que não documenta testemunho: aviso, não erro;
- dependência de evidência **retratada** recusada em afirmação, posição e
  conexão publicadas — e aceita enquanto o registro é rascunho, porque a
  retratação impede publicar, não impede guardar o histórico.

### `connectionsFrom`: duplicação removida, com equivalência provada

A avaliação externa pediu equivalência provada antes de unificar, e estava certa
ao recusar a remoção que eu havia proposto. A função montava a chave da âncora
com template string à mão; o formato **coincidia** com `anchorKey`, então não
havia resultado errado — havia duplicação frágil.

Agora ela delega a `anchorKey`/`anchorsOverlap`, e o teste
"monta a mesma chave que `anchorKey`" fixa a equivalência para cinco âncoras,
incluindo intervalo. O contrato de direção foi preservado: `to` só conta em
conexão `bidirecional`, e há teste de que conexão unidirecional cuja ponta `to`
é a consultada **não** entra.

Uma mudança de assinatura: o parâmetro era um tipo estrutural com `canon:
string`, incompatível com `anchorsOverlap`, e passou a ser `PassageAnchor`.
Verifiquei os consumidores antes — **zero** em `src/` e `tests/` — e o
estreitamento só recusa entrada que já não funcionaria.

---

## Item 4 — passagens que atravessam capítulos

### Correção de severidade: eu exagerei na §9.3

O relatório anterior afirmou que Gênesis 1:31–2:3 "não é representável". Era
verdade sobre **uma** âncora e enganoso sobre o modelo. Evidência, afirmação e
posição guardam `anchors` como **lista** (`z.array(PassageAnchorSchema).min(1)`),
então a perícope é representável hoje, como duas partes — e, com a política de
sobreposição do item 1, é alcançada ao consultar qualquer versículo de qualquer
parte. Provado em `tests/server/knowledge-graph-crosschapter.test.ts` (6 testes).

Não era, portanto, "a questão de modelagem mais séria do documento". A questão
mais séria era a §9.5, que o avaliador encontrou e eu não.

### O que o teste me obrigou a redesenhar

Ao escrever a prova, o `scope` que eu havia criado no item 1 falhou: ele listava
só as âncoras que a consulta tocava. Quem consultasse Gênesis 2:2 veria
"GEN 2:1-3" e **nunca saberia que a afirmação começa em 1:31** — exatamente o
engano que o campo existe para evitar.

`CardScope` passou a carregar as duas coisas: `keys` com a extensão inteira em
ordem canônica, e `matched` com as partes que a consulta tocou. `reference`
enumera a extensão completa, partes separadas por `; `.

Enumerar não é afirmar contiguidade: quem lê vê `GEN 1:31; GEN 9:1`, duas
referências separadas, não um intervalo.

### O que não foi feito, e por que não podia ser

- **Conexão entre capítulos não é representável.** `PassageConnection` tem
  `from` e `to` como âncora única, não lista. Mudar é alterar contrato público,
  e a fila exige decisão registrada do proprietário.
- **Nada declara que as partes formam uma extensão.** Lista de duas âncoras é
  indistinguível de registro sobre dois versículos sem relação.
- **Contiguidade é indecidível com os dados de hoje.** Saber que 2:1 vem logo
  depois de 1:31 exige a contagem de versículos por capítulo. `anchors.ts`
  conhece cânones, ordem dos livros e sistemas de versificação, mas **não** tem
  essa tabela. Inventá-la seria inventar versificação, o que a fila proíbe e
  que depende de C29.

Recomendação, para quando houver decisão: manter a âncora como é e acrescentar
um identificador de extensão (`spanId`) compartilhado pelas partes, mais um
validador de contiguidade que só opere **com** a tabela de versificação. Isso
preserva a chave citável, a ordenação e a API, e não exige mudar o primitivo.

---

## Item 5 — plano de integração e prova vertical de Gênesis 1:1

Plano, não execução: a fila proíbe schema remoto e importação de corpus, e a
prova com dados reais depende de C29.

### O que já está pronto para a integração

A porta está definida e testada por duplo: `KnowledgeGraphRepository` com
`loadPassage(query): Promise<PassageBundleRows>`. A implementação Drizzle é
mecânica depois que as tabelas existirem — a camada de leitura não muda.

### Forma das tabelas que o modelo exige

Oito tabelas de registro (`works`, `editions`, `artifacts`, `witnesses`,
`evidence`, `claims`, `positions`, `connections`), mais `versification_bridges`
e `witness_readings`.

A decisão de desenho que importa: **âncora é tabela própria, não coluna.** Como
os registros têm lista de âncoras, cada um precisa de uma tabela de ligação —
`evidence_anchors`, `claim_anchors`, `position_anchors` — com as colunas
`canon`, `versification`, `book`, `chapter`, `verse_start`, `verse_end`.

Guardar a âncora como coluna única, ou como chave de texto, inviabilizaria a
consulta por sobreposição que o item 1 fixou.

### Consulta e índice

A consulta por passagem é sobreposição de intervalo dentro de capítulo:

```sql
WHERE canon = $1 AND versification = $2 AND book = $3 AND chapter = $4
  AND verse_start <= $6 AND verse_end >= $5
```

Índice composto `(canon, versification, book, chapter, verse_start, verse_end)`
em cada tabela de âncoras atende por prefixo e ainda serve à ordenação canônica.
Nomes de tabela e de índice são decisão do operador; não os fixei.

### Espaço, no plano gratuito

O banco está perto de **296 MB de 500 MB** nominais, conforme a tarefa do
Claude 1 — restam cerca de 204 MB, e a frente lexical também vai consumir.

O grafo é metadado: obras, edições, localizadores, estados de revisão. O que
cresce é `evidence.content`, com citações curtas e resumos editoriais. Para
Gênesis 1:1, a ordem de grandeza é de **kilobytes**, não megabytes. A frente não
é a ameaça à cota; a importação de corpus é. Nenhum serviço pago é necessário.

### Bloqueios reais da prova vertical

1. **C29** — aprovação de edição, licença e versificação. Sem isso não há o que
   publicar: a camada recusa `rascunho` e recusa direitos não liberados, que é o
   comportamento correto.
2. **Nomes de tabela** — decisão do operador, e a migration é remota, o que a
   fila proíbe sem ordem explícita.
3. **Dados** — nenhum conteúdo real existe no acervo do grafo hoje.

Até os três saírem, a prova possível é com fixtures declaradas, que é o que as
108 provas da frente fazem. **Não concluo que qualquer fonte esteja aprovada nem
que haja conteúdo publicado.**

---

## Item 6 — verificação e passagem

Executado em 25/11/2026, 05:26–05:30.

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | limpo nos arquivos desta frente |
| `npx eslint` (domínio, servidor e 7 suítes) | zero erros, zero avisos |
| suítes da frente | **108** em 7 arquivos (eram 60 em 2 no início da noite) |
| suíte completa | **518 passaram, 7 ignorados**, 52 arquivos |

Distribuição da frente: domínio 40, intervalos 12, referências 12, servidor 24,
vazamento 7, identidade 7, entre capítulos 6.

### Mutações, para provar que os testes têm dentes

| Mutação | Testes que falharam |
| --- | --- |
| reverter a sobreposição para igualdade de chave | 4 |
| `details` do rascunho carregando o conteúdo | 2 |

As duas revertidas, com reversão provada por `diff`.

### Arquivos alterados

Domínio: `evidence.ts` (predicado por sobreposição), `connections.ts`
(`connectionsFrom` delegando, assinatura estreitada).
Servidor: `tree.ts` (`CardScope`, `scopeOf`, `rejectDisputedIds`, filtro de
conexões por sobreposição).
Testes: `knowledge-graph-fixtures.ts` (âncoras de intervalo), quatro arquivos
novos, dois ampliados.
Registros: este arquivo e `knowledge-graph-001-itens-1-2.md`.

### Pendências, com o motivo de cada uma

| Pendência | Por que não foi feita |
| --- | --- |
| Motivo `direitos_nao_liberados` inalcançável | exige erro tipado no domínio; farejar mensagem na leitura seria pior |
| "edição não está registrada" quando a edição foi recusada | mensagem literalmente falsa, informação presente no `withheld`; mesma correção tipada |
| Conexão entre capítulos | mudança de contrato público, exige decisão do proprietário |
| `spanId` e contiguidade | depende da tabela de versificação (C29) |
| Oito exports mortos restantes | a fila manda verificar consumidores antes, e não verifiquei um por um |
| Migration, repositório Drizzle, prova vertical | C29, nomes de tabela, migration remota |

Nada foi feito fora de `src/domain/knowledge-graph/**`,
`src/server/knowledge-graph/**`, `tests/{domain,server}/knowledge-graph*` e
`tasks/product/knowledge-graph*`. Sem rede, sem `.env*`, sem banco remoto, sem
migration, sem commit, push ou deploy. `app/progresso/**` e os testes de
progresso não foram tocados.

**Não marco a frente como encerrada.** Os quatro critérios literais do aceite
têm implementação e teste, e os dois bloqueios que a avaliação externa levantou
estão resolvidos — a divergência de §9.5 e o teste adversarial de vazamento.
Restam as pendências acima, e três delas são decisão de outra pessoa.
