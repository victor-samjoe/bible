# KNOWLEDGE-GRAPH-001 — árvore de conhecimento por passagem (fila A2)

**Data:** 24/11/2026
**Fila:** `CLAUDE_MVP_EXECUTION_QUEUE.txt`, frente A2 (P0). Decisão de produto em
`docs/VERSE_KNOWLEDGE_GRAPH.md`; tarefa de fila correspondente, C26.
**Escopo executado:** contratos e validações puros, mais a camada de leitura que aplica os estados
de revisão na fronteira de servir.
**Escopo deliberadamente fora:** UI, IA, corpus novo, migration e banco remoto. Nenhum texto
bíblico, aparato, tradução ou léxico real entrou nesta frente.

A frente foi **revisada e concluída** nesta data. O que já existia em 19/11 — âncora, proveniência,
evidência, ramos, afirmação, conexão, revisão e testemunho — foi conferido contra os critérios de
aceite; duas lacunas reais apareceram e foram fechadas, e a camada de leitura, que o escopo da A2
reservava e estava vazia, foi escrita.

---

## 1. Estado exato

| Item | Estado |
| --- | --- |
| Âncora canônica (cânon + versificação + livro + capítulo + versículo) | **feito** — `src/domain/knowledge-graph/anchors.ts` |
| Ponte de versificação documentada, sem atalho por número | **feito** — `mapAnchor` recusa travessia sem ponte |
| Obra → edição → ativo, com direitos por edição | **feito** — `provenance.ts` |
| Localização reproduzível tipada (9 formas) | **feito** — `LocatorSchema`, obrigatória em toda evidência |
| Ontologia de ramos, relações e tipos de afirmação | **feito** — `branches.ts`, listas fechadas |
| Evidência com fonte, localização e origem | **feito** — `evidence.ts` |
| Recusa de síntese de agente como evidência | **feito**, com motivo nomeado |
| Afirmação, ligação tipada e posição interpretativa | **feito** — `claims.ts` |
| Conexão tipada entre passagens | **feito** — `connections.ts` |
| Estados de revisão e transições | **feito** — `review.ts`, sem caminho de `rascunho` a `publicado` |
| Testemunho textual e leitura atestada | **feito**, e agora **ligado** ao resto (ver §2.1) |
| Obrigação `requiresWitness` | **feita valer** nesta revisão (ver §2.1) |
| Camada de leitura por passagem | **feito** nesta revisão — `src/server/knowledge-graph/**` |
| Repositório Drizzle das tabelas | **não feito, de propósito** (ver §4) |
| Testes de domínio | **40**, em `tests/domain/knowledge-graph.test.ts` |
| Testes de servidor | **20**, em `tests/server/knowledge-graph.test.ts` |
| UI, rota, endpoint | **nenhum** — a frente é de contrato |

## 2. O que esta revisão encontrou e corrigiu

### 2.1 `requiresWitness` era uma obrigação declarada que nenhum código conferia

`branches.ts` declara `requiresWitness: true` para `texto-testemunhos` e `critica-textual`. Nada
lia esse campo — nem `validateEvidence`, que já conferia `requiresProvenanceChain` e
`requiresWorkLocalization` ao lado dele. Na prática, "o grego traz X" podia ser cadastrado,
validado e publicado sem identificar manuscrito, versão, citação ou edição crítica.

Pior do que a ausência era a aparência: o campo existia, estava preenchido com `true` e passava a
impressão de que a regra valia.

Correção:

- `EvidenceFragment` passou a ter `witnessId`, obrigatório nos ramos que declaram a obrigação e
  `null` nos outros. Evidência de ramo que não documenta testemunho e traz `witnessId` recebe
  **aviso**, não erro: o registro não fica errado, só não tem efeito ali.
- Com o índice de proveniência, o testemunho precisa estar registrado **e** a edição por onde sua
  leitura é conhecida também. Essa segunda conferência é a que importa: nós não lemos o manuscrito,
  lemos uma edição que informa o que ele traz. Sem a edição no registro, o intermediário desaparece
  e a afirmação passa a parecer leitura direta do objeto.
- `evidencePublicationErrors` passou a exigir direitos liberados também na edição do testemunho.

### 2.2 `witnesses.ts` era um módulo órfão

O arquivo existia desde 19/11 com `TextualWitnessSchema`, `WitnessReadingSchema` e dois
validadores de forma. **Nada no repositório o importava e nenhum teste o exercitava.** As duas
chaves que o tornam útil — `witnessId` e `evidenceId` em `WitnessReading` — eram `stableId` sem
conferência nenhuma.

Correção: `validateWitnessReading` agora confere as duas pontas. A que mais importa é a última —
uma leitura cuja evidência está ancorada em outro versículo é uma colação que ninguém pode refazer,
porque o aparato citado não fala da passagem que o registro afirma. Também recusa evidência de ramo
que não documenta testemunho textual (`filologia`, por exemplo).

Para manter `witnesses.ts` folha e evitar ciclo de import com `evidence.ts`, a dependência foi
declarada como tipo estrutural mínimo (`AttestingEvidence`), que `EvidenceFragment` satisfaz.

### 2.3 Os estados de revisão não tinham fronteira que os aplicasse

Os contratos sabiam **dizer** que um registro estava em `rascunho`. Não havia camada que se
recusasse a servi-lo — `src/server/knowledge-graph/`, reservado à A2 pela fila, estava vazio. Um
estado de revisão sem ponto de aplicação é um campo que todos gravam e ninguém consulta, e o que
apareceria ao leitor voltaria a depender de quem cadastrou por último.

Correção: `projectPassageTree` é a fronteira. Três regras:

1. **Só `publicado` sai**, e em cadeia: afirmação publicada apoiada em evidência não publicada já
   era recusada pelo domínio, e a projeção não a contorna.
2. **Nada é omitido em silêncio.** Todo registro descartado aparece em `withheld` com motivo
   (`invalido`, `nao_publicado`, `direitos_nao_liberados`, `fora_da_passagem`). Uma árvore que
   mostra dois cartões porque oito falharam, sem dizer isso, afirma cobertura que não tem.
3. **Ramo sem material publicado é declarado vazio, não escondido.** A lacuna é informação, como
   `docs/VERSE_KNOWLEDGE_GRAPH.md` §3 exige ao proibir a promessa de "todos os autores".

`withheld` carrega identificador, tipo e motivo — **nunca o conteúdo** do registro recusado. Vazar
a citação de uma evidência não publicada pelo relatório de recusa anularia a recusa; há teste para
isso.

Também: a projeção refiltra por âncora. A porta busca por passagem, mas um repositório que devolva
vizinhos não deve alargar a árvore em silêncio.

## 3. Decisões tomadas, com o motivo

1. **A porta recebe linhas `unknown` e a projeção revalida tudo.** Quem responde é banco,
   importador ou fixture, e nenhum dos três é de confiança para o tipo. É o tratamento que
   `projectOriginalVerses` já dá às linhas do leitor de originais.
2. **Um pacote por passagem, não sete idas.** A árvore só pode ser validada com a proveniência na
   mão: evidência sem a edição que a publica não passa pela própria validação do domínio. Buscar em
   partes convidaria a montar a árvore com metade do pacote.
3. **`not_published` em vez de `not_found`.** As duas situações são diferentes para quem lê: a
   passagem existe, o acervo é que não cobriu. A árvore acompanha a recusa, porque `withheld` e
   `emptyBranches` explicam o vazio.
4. **Filtro de ramos vazio significa todos.** É o caso normal de quem abre a passagem sem escolher
   perspectiva; ramo inexistente no filtro é recusa de consulta, não lista vazia.
5. **Citação montada dos registros, nunca digitada.** `citationLabel` compõe autor, obra, edição,
   ano e localização. Bibliografia digitada de memória é o modo mais fácil de uma referência errada
   entrar e nunca mais ser conferida.
6. **A projeção não lança.** Função total: entrada ruim produz árvore vazia com os motivos, porque
   quem chama precisa poder exibir "não localizado no acervo" sem distinguir falha de ausência.
7. **`indexProvenance` ganhou terceiro parâmetro opcional.** Compatível com as chamadas anteriores;
   o índice de testemunhos tem padrão vazio.

## 4. O que **não** foi feito, e por quê

- **Repositório Drizzle e migration das tabelas.** O modelo conceitual de
  `docs/VERSE_KNOWLEDGE_GRAPH.md` §7 não tem migration, e criar uma obrigaria a fixar nomes de
  tabela antes da decisão — além de violar a regra da fila sobre migration. A porta injetada é
  suficiente para provar a camada, e os testes a provam com repositório em memória.
- **Prova vertical de Gênesis 1:1 com dados reais.** Depende de edição, licença e versificação
  aprovadas (fila C29) e de importação autorizada. As fixtures são declaradamente de teste.
- **`research_runs`, `study_documents` e blocos de estudo.** São as frentes C27 e seguintes. O
  contrato de evidência já as antecipa ao recusar `sintese_de_agente` e ao apontar o lugar próprio
  da síntese.
- **Entitlement Pro.** Fila C28, e depois da prova de valor.
- **Qualquer UI.** O aceite da A2 é explícito: sem UI.

## 5. Critérios de aceite, conferidos um a um

| Critério da fila | Onde está | Teste que o recusa quando falta |
| --- | --- | --- |
| Relações tipadas | listas fechadas em `branches.ts`; `relationAllowedIn`, `claimTypeAllowedIn` | tipo de afirmação fora do ramo; relação não usada no ramo; relação fora da lista; conexão com relação do ramo errado; apoio só por contestação; evidência ligada duas vezes |
| Proveniência obrigatória | `editionId` em toda evidência; obra → edição → ativo; `witnessId` nos ramos que o exigem | evidência sem edição; edição/ativo não registrados; ativo de outra edição; testemunho não registrado; testemunho sem a edição que informa sua leitura; ramo de testemunho sem `witnessId` |
| Localização obrigatória | `LocatorSchema` em toda evidência; `requiresWorkLocalization` | evidência sem localização (5 formas inválidas); referência canônica na história da interpretação; posição cuja evidência não localiza a obra; leitura cuja evidência está em outra passagem |
| Estados de revisão explícitos | `review.ts`; aplicação em `projectPassageTree` | `rascunho` → `publicado` recusado; revisor humano, diferente do autor, com data; motivo em rejeição/retratação; publicado apoiado em não publicado (afirmação, posição e conexão); âncora de cânon pendente; rascunho não servido |

Dois critérios implícitos, também cobertos: síntese de agente recusada como evidência, com o motivo
nomeado; e nenhum atalho entre sistemas de versificação sem ponte documentada.

## 6. Verificações executadas em 24/11/2026

```bash
npx vitest run tests/domain/knowledge-graph.test.ts tests/server/knowledge-graph.test.ts
#   2 arquivos, 60 testes, todos passando

npx vitest run
#   41 arquivos, 401 testes, todos passando (nenhuma regressão nas outras frentes)

npx tsc --noEmit
#   sem erro

npx eslint src/domain/knowledge-graph src/server/knowledge-graph \
           tests/domain/knowledge-graph.test.ts tests/domain/knowledge-graph-fixtures.ts \
           tests/server/knowledge-graph.test.ts
#   sem erro e sem aviso
```

`npm run lint` sobre o repositório inteiro continua acusando ~3.400 erros **pré-existentes**, quase
todos em `data/sources/originals/**` — corpora extraídos, com JavaScript de terceiros. Nenhum é
desta frente e nenhum foi tocado.

**Teste de mutação, para provar que os testes recusam de verdade.** Três regras novas foram
desligadas uma por vez e a suíte foi reexecutada:

| Regra desligada | Resultado |
| --- | --- |
| obrigação de `witnessId` em `validateEvidence` | 2 testes falharam (domínio e servidor) |
| filtro `isPublished` da evidência em `projectPassageTree` | 1 teste falhou |
| refiltro por âncora em `projectPassageTree` | 1 teste falhou |

As três mutações foram revertidas e a reversão foi conferida por `diff` contra cópia anterior.

Nenhuma verificação de produção, deploy, rede ou banco remoto foi feita. Nenhum `.env*` foi lido ou
alterado. Nenhum commit foi feito.

## 7. Arquivos desta frente

| Arquivo | Estado |
| --- | --- |
| `src/domain/knowledge-graph/evidence.ts` | alterado — `witnessId`, obrigação do ramo, testemunhos no índice, direitos do testemunho |
| `src/domain/knowledge-graph/witnesses.ts` | alterado — validação cruzada das duas pontas, índice, `branchAdmitsWitness` |
| `src/server/knowledge-graph/contracts.ts` | novo — consulta, porta e motivos de recusa |
| `src/server/knowledge-graph/tree.ts` | novo — projeção publicável, cobertura declarada e `withheld` |
| `src/server/knowledge-graph/reader.ts` | novo — leitor com falha fechada |
| `src/server/knowledge-graph/index.ts` | novo — superfície da camada |
| `tests/domain/knowledge-graph-fixtures.ts` | novo — conjunto coerente e publicável, compartilhado |
| `tests/domain/knowledge-graph.test.ts` | ampliado — 6 → 40 testes, organizados pelos critérios de aceite |
| `tests/server/knowledge-graph.test.ts` | novo — 20 testes da fronteira de servir |
| `docs/VERSE_KNOWLEDGE_GRAPH.md` | alterado — seção 10, estado de implementação |
| `tasks/product/knowledge-graph-001.md` | novo — este arquivo |

Os demais módulos do domínio (`anchors`, `branches`, `claims`, `connections`, `primitives`,
`provenance`, `review`) foram **lidos e conferidos** contra os critérios, e não precisaram de
mudança.

Nada fora dos caminhos exclusivos da A2 foi tocado. Em particular, `src/domain/alignment/**`,
`src/domain/passage-alignment*`, `scripts/*alignment*` e os testes de alinhamento ficaram
intactos, porque a A1 está em execução paralela.

## 8. Próximo passo quando esta frente for retomada

1. Decidir as tabelas e a migration do modelo de §7 da documentação; só então escrever o
   repositório Drizzle contra a porta já definida.
2. Prova vertical de Gênesis 1:1, depois de C29 liberar edição, licença e versificação.
3. Estudo estruturado e inserção manual de cartões (C27), que é quem consome esta árvore.
4. Agente de pesquisa somente depois disso, e ligado ao acervo autorizado — nunca como fonte.
