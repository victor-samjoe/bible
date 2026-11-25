# KNOWLEDGE-GRAPH-001 — resultado para validação externa

**Para:** revisor externo (GPT), sem acesso ao repositório.
**De:** sessão Claude Code, frente A2 da `CLAUDE_MVP_EXECUTION_QUEUE.txt`.
**Data:** 24/11/2026.

Este documento é auto-contido: traz os trechos de código que sustentam cada
afirmação, para que a validação não dependa de confiança nem de acesso aos
arquivos. Onde eu tenho dúvida, está escrito que tenho dúvida.

---

## 0. O que eu peço ao validador

Não reescreva o código. **Ataque as afirmações.** Para cada uma, responda uma de
três coisas: *confere*, *não confere* (com o contraexemplo), ou *não é
verificável pelo que está aqui* (dizendo o que falta).

Prioridade: a seção **9** reúne os pontos em que eu suspeito de mim mesmo. Comece
por lá se o tempo for curto. O formato de devolução está na seção 10.

---

## 1. O que a fila pediu, literalmente

> **Aceite:** relações tipadas, proveniência/localização obrigatória, estados de
> revisão explícitos e testes que recusam evidência sem fonte/localização.

> **Escopo exclusivo:** `src/domain/knowledge-graph/**`,
> `src/server/knowledge-graph/**`, `tests/domain/knowledge-graph*`,
> `tests/server/knowledge-graph*`, `docs/VERSE_KNOWLEDGE_GRAPH.md` e tarefa nova
> em `tasks/product/knowledge-graph*`.

Restrições em vigor: sem rede, sem alterar `.env*`, sem migration remota, sem
deploy, commit ou push; outras instâncias (A1, A3) trabalhando em paralelo em
caminhos próprios. Nada disso foi violado.

A frente **não começou do zero**: os nove módulos de domínio já existiam, com
seis testes passando. O pedido era *revisar e concluir* — ou seja, a pergunta
real era "os contratos cumprem o que dizem cumprir?". A resposta foi **não em
dois pontos**, e é isso que a seção 4 documenta.

---

## 2. Mapa do que existe

| Arquivo | Linhas | Estado |
| --- | --- | --- |
| `src/domain/knowledge-graph/anchors.ts` | 422 | já existia |
| `src/domain/knowledge-graph/branches.ts` | 257 | já existia |
| `src/domain/knowledge-graph/claims.ts` | 257 | já existia |
| `src/domain/knowledge-graph/connections.ts` | 101 | já existia |
| `src/domain/knowledge-graph/evidence.ts` | 334 | **alterado** (era 281) |
| `src/domain/knowledge-graph/primitives.ts` | 117 | já existia |
| `src/domain/knowledge-graph/provenance.ts` | 348 | já existia |
| `src/domain/knowledge-graph/review.ts` | 135 | já existia |
| `src/domain/knowledge-graph/witnesses.ts` | 224 | **alterado** (era 142) |
| `src/server/knowledge-graph/contracts.ts` | 93 | **novo** |
| `src/server/knowledge-graph/tree.ts` | 449 | **novo** |
| `src/server/knowledge-graph/reader.ts` | 61 | **novo** |
| `src/server/knowledge-graph/index.ts` | 38 | **novo** |
| `tests/domain/knowledge-graph-fixtures.ts` | 329 | **novo** |
| `tests/domain/knowledge-graph.test.ts` | 619 | **reescrito** (era 143) |
| `tests/server/knowledge-graph.test.ts` | 277 | **novo** |

Também alterados: `docs/VERSE_KNOWLEDGE_GRAPH.md` (seção 10 acrescentada),
`tasks/product/knowledge-graph-001.md` (novo, registro da tarefa) e a linha da A2
na fila.

---

## 3. A ontologia, em uma tela

- **Âncora** = cânon + versificação + livro + capítulo + intervalo de versículos.
  Chave citável: `protestante/blivre-pt/GEN 1:1`.
- **Dez ramos** (filologia, texto-testemunhos, história-interpretação, literário,
  arqueologia, etc.), cada um com **obrigações declaradas**: `requiresWitness`,
  `requiresTradition`, `requiresConfidenceGrade`, `requiresProvenanceChain`,
  `requiresWorkLocalization`.
- **Nove relações tipadas, lista fechada:** `traduz`, `cita`, `interpreta`,
  `apoia`, `contesta`, `contextualiza`, `alude`, `recebe`, `aplica`.
- **Onze tipos de afirmação**, cada um admitido só em certos ramos.
- **Cadeia de proveniência:** obra → edição → ativo. Os **direitos vivem na
  edição**, não na obra — é a edição que tem licença.
- **`Locator` com nove formas tipadas:** `pagina`, `secao`, `paragrafo`, `folio`,
  `linha`, `referencia_canonica`, `aparato`, `verbete`, `numero_catalogo`.
- **Estados de revisão:** `rascunho`, `em_revisao`, `revisado`, `publicado`,
  `rejeitado`, `retratado`. Não há caminho direto de rascunho a publicado; o
  revisor tem de ser humano e diferente do autor; retratação preserva histórico.

---

## 4. As duas lacunas que a revisão encontrou

### 4.1 Uma obrigação declarada que nenhum código lia

`requiresWitness: true` estava declarado em **dois** ramos — `texto-testemunhos`
e `critica-textual` (este último junto com `requiresConfidenceGrade`).
**Nenhuma linha do sistema consultava esse campo.** Isso é pior que a ausência da
regra: o campo *parecia* uma regra, então quem lesse o contrato concluiria que o
sistema exige identificar o manuscrito — e ele não exigia. Evidência de ramo
textual podia ser cadastrada sem dizer *qual testemunho* ela atesta.

Correção, em `evidence.ts`. Campo novo no schema:

```ts
/**
 * Testemunho que o fragmento atesta. Obrigatório nos ramos que declaram
 * `requiresWitness`; `null` nos demais, onde não há objeto textual a nomear.
 */
witnessId: stableId.nullable().default(null),
```

Imposição em `validateEvidence`:

```ts
if (obligations.requiresWitness && evidence.witnessId === null) {
  errors.push(
    `evidence.witnessId: o ramo ${evidence.branch} exige identificar o testemunho atestado (manuscrito, versão antiga, citação ou edição crítica)`,
  );
}
if (!obligations.requiresWitness && evidence.witnessId !== null) {
  warnings.push(
    `O ramo ${evidence.branch} não documenta testemunho textual; ${evidence.witnessId} fica registrado sem efeito na validação do ramo`,
  );
}
```

E a verificação cruzada, que me parece a parte mais importante:

```ts
if (evidence.witnessId !== null) {
  const witness = index.witnesses.get(evidence.witnessId);
  if (witness === undefined) {
    errors.push(`evidence.witnessId: testemunho ${evidence.witnessId} não está registrado`);
  } else if (!index.editions.has(witness.publishedInEditionId)) {
    // A leitura do manuscrito chega por uma edição. Se essa edição não está
    // cadastrada, o intermediário desapareceu do registro e a afirmação
    // passa a parecer leitura direta do objeto.
    errors.push(
      `evidence.witnessId: a edição ${witness.publishedInEditionId}, por onde a leitura de ${witness.id} é conhecida, não está registrada`,
    );
  }
}
```

**A afirmação a validar:** ninguém lê um manuscrito do século V diretamente; lê
uma edição que o transcreve. Se a edição intermediária não está registrada, o
registro passa a sugerir acesso direto ao objeto, que é falso. Por isso a
ausência da edição do testemunho é **erro**, não aviso.

### 4.2 Um módulo órfão

`witnesses.ts` (142 linhas) não era importado por **nada** e não tinha **nenhum**
teste. `witnessId` e `evidenceId` eram `stableId` sem verificação. Código que
ninguém chama e ninguém testa não é contrato, é intenção.

Correção: o módulo ganhou validação com contexto e permaneceu **folha** (não
importa `evidence.ts`) por meio de um tipo estrutural mínimo — o que evita ciclo
de importação sem inverter a dependência:

```ts
export function branchAdmitsWitness(branch: BranchId): boolean {
  return branchDefinition(branch).obligations.requiresWitness;
}

export type AttestingEvidence = {
  readonly id: string;
  readonly branch: BranchId;
  readonly anchors: readonly PassageAnchor[];
};

export function validateWitnessReading(
  input: unknown,
  context: WitnessReadingContext = {},
): readonly string[] {
  /* testemunho registrado; evidência registrada; branchAdmitsWitness(fragment.branch);
     fragment.anchors contém anchorKey(reading.anchor) */
}
```

`EvidenceFragment` satisfaz `AttestingEvidence` estruturalmente, sem declarar que
o satisfaz. **Ponto a validar:** isso é elegante ou é frágil? Se alguém renomear
um campo de `EvidenceFragment`, o acoplamento se rompe em silêncio no tipo
estrutural. Eu aceitei o risco para não criar ciclo; diga se a troca vale.

---

## 5. A fronteira que faltava: onde o estado de revisão passa a ter efeito

Esta é a parte **nova**, e a mais consequente. Os contratos sabiam dizer que um
registro está em `rascunho`. Não havia lugar nenhum onde `rascunho` **não fosse
servido** — porque não havia camada de leitura. Estado de revisão sem ponto de
imposição é um campo que todos gravam e ninguém consulta.

`src/server/knowledge-graph/tree.ts` impõe três regras:

1. **Só `publicado` sai** — para evidência, afirmação, posição e conexão, e vale
   em cadeia: afirmação publicada apoiada em evidência não publicada é recusada.
2. **Nada é omitido em silêncio** — todo registro descartado aparece em
   `withheld` com motivo. Uma árvore que mostra dois cartões porque oito falharam
   na validação, sem dizer isso, **afirma cobertura que não tem**.
3. **Ramo sem material publicado é declarado vazio, não escondido** — a lacuna é
   informação: diz que a plataforma não cobriu aquela perspectiva nesta passagem,
   em vez de sugerir que não há nada a dizer.

```ts
export const WITHHELD_REASONS = ["invalido", "nao_publicado", "direitos_nao_liberados", "fora_da_passagem"] as const;

export type WithheldRecord = {
  readonly kind: WithheldKind;
  readonly id: string | null;
  readonly reason: WithheldReason;
  readonly details: readonly string[];
};
```

`withheld` carrega identificador, tipo e motivo — **nunca o conteúdo recusado**.
Vazar a citação de uma evidência não publicada pelo relatório de recusa anularia
a própria recusa. Verifiquei de duas formas: por teste (`JSON.stringify` da
árvore não contém o texto do rascunho) e por inspeção (**nenhuma mensagem de
validação do domínio interpola `quotation`, `summary`, `statement` ou `thesis`**
— as mensagens citam identificadores e nomes de campo). A segunda verificação é
a que importa, porque vale para registros que a fixture não cobre.

O leitor é falha-fechada, no padrão já usado em `src/server/originals/`:

```ts
export function createKnowledgeGraphReader(repository: KnowledgeGraphRepository | null | undefined): KnowledgeGraphReader {
  return {
    available: Boolean(repository),
    async read(input: unknown): Promise<KnowledgeGraphResult> {
      const query = parseKnowledgeGraphQuery(input);
      if (!query) return { ok: false, reason: "invalid_query" };
      if (!repository) return { ok: false, reason: "unavailable" };
      try {
        const rows = await repository.loadPassage(query);
        const tree = projectPassageTree(query, { /* cada campo guardado com Array.isArray */ });
        return treeIsEmpty(tree) ? { ok: false, reason: "not_published", tree } : { ok: true, tree };
      } catch { return { ok: false, reason: "unavailable" }; }
    },
  };
}
```

Duas decisões a validar:

- **`not_published` é distinto de `not_found` de propósito.** A passagem existe;
  o acervo é que não a cobriu. Confundir as duas ensina o leitor a achar que a
  Bíblia tem lacunas onde o acervo tem.
- **As linhas chegam como `unknown`.** Banco, importador e fixture são fontes não
  confiáveis quanto a tipo; a projeção valida tudo. Custo: erro de tipo aparece
  em tempo de execução como `invalido`, não em compilação.

Um detalhe que considero importante: `ClaimCard` carrega
`interpretive: boolean`, derivado de `claimNeedsInterpretiveLabel`, para que a
interface **tenha de** rotular interpretação como interpretação, em vez de
servi-la como dado. E `EvidenceCard.citation` é montada por
`citationLabel(work, edition, locator)` — nunca digitada à mão.

---

## 6. Aceite ↔ teste que recusa a ausência

Cada critério da fila tem teste que falha se a regra sair. Não listo os 60; listo
o mapeamento e o que cada grupo prova.

| Critério da fila | Onde é imposto | O que o teste recusa |
| --- | --- | --- |
| relações tipadas | `claims.ts`, `connections.ts`, `branches.ts` | tipo de afirmação fora do ramo; relação não usada no ramo; relação fora da lista fechada; apoio sustentado só por contestação; link de evidência duplicado |
| proveniência obrigatória | `evidence.ts`, `provenance.ts` | evidência sem edição; edição não registrada; ativo de outra edição; cadeia material ausente em arqueologia; testemunho exigido e ausente; testemunho sem a edição que o publica |
| localização obrigatória | `evidence.ts` (`Locator`) | evidência sem `locator`; falta de localização na obra em história da interpretação; posição sem localização |
| estados de revisão explícitos | `review.ts` + `tree.ts` | rascunho→publicado direto; revisor não humano ou igual ao autor; recusa/retratação sem motivo; publicado dependendo de evidência não publicada; **rascunho servido ao leitor** |
| direitos | `provenance.ts` | status indefinido concedendo permissão; citação não permitida; citação acima do limite; direitos não verificados |
| versificação | `anchors.ts` | igualdade numérica tratada como equivalência (Miqueias 5:2 PT = 5:1 hebraico); `mapAnchor` sem ponte; ponte sem documentação |

Grupos de teste:

```
tests/domain/knowledge-graph.test.ts  (40 testes)
  fixtures publicáveis · âncora canônica · proveniência e localização
  obrigatórias · direitos da fonte · relações tipadas · estados de revisão

tests/server/knowledge-graph.test.ts  (20 testes)
  consulta · leitor falha fechada · árvore publicada · o que a camada
  se recusa a servir
```

As fixtures são um conjunto **coerente e publicável**, para que cada teste
estrague **um** campo por vez — a única forma de provar que a recusa veio da
regra em exame e não de outra ausência qualquer. Nenhum texto bíblico, aparato,
tradução ou léxico real entra nelas: tudo é inventado e marcado como "fixture".

---

## 7. Verificações, reexecutadas agora (24/11/2026, 21:57–21:59)

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | **limpo**, saída vazia, exit 0 |
| `npx eslint` nos arquivos da frente | **limpo**, zero erros e zero avisos |
| testes da frente | **60/60** (40 domínio + 20 servidor), 2 arquivos |
| suíte completa | **416/416**, 43 arquivos, 8,59s |

A suíte completa subiu de 401 para 416 testes entre a primeira execução e esta:
é a A3 acrescentando testes em paralelo, não efeito desta frente.

`npm run lint` no repositório inteiro continua com ~3400 erros **pré-existentes**,
quase todos em `data/sources/originals/**` (corpora extraídos de terceiros).
Nenhum vem desta frente. Não os toquei: não estão no escopo exclusivo da A2.

**Teste de mutação** — porque suíte verde prova que o código passa nos testes,
não que os testes valham algo. Três mutações, uma por critério:

| Mutação introduzida | Testes que falharam |
| --- | --- |
| remover a exigência de `witnessId` nos ramos que a declaram | 2 |
| servir `rascunho` junto com `publicado` | 1 |
| aceitar igualdade numérica como equivalência entre versificações | 1 |

Cada mutação foi revertida e a reversão provada por `diff`. **Ponto fraco que eu
mesmo aponto:** "1 teste falhou" é cobertura mínima. Uma mutação que derruba só
um teste indica que a regra tem um único guardião. Diga se isso deveria ser
reforçado antes do aceite.

---

## 8. O que deliberadamente não foi feito

- **Migration e tabelas** para o modelo conceitual (§7 da documentação). Depende
  de decisão do operador sobre nomes de tabela, e a fila proíbe migration remota
  sem ordem explícita.
- **Repositório Drizzle** contra a porta já definida. A porta
  (`KnowledgeGraphRepository`) existe e está testada por duplo; a implementação
  real espera as tabelas.
- **Prova vertical de Gênesis 1:1 com dados reais.** Bloqueada por C29: depende
  de aprovação de edição, licença e versificação. Não inventei dados para
  simular cobertura — seria exatamente o que a camada de `withheld` existe para
  impedir.
- **Interface.** Fora do escopo da A2.

---

## 9. Pontos em que eu suspeito de mim mesmo — ataque estes primeiro

1. **`witnessId: stableId.nullable().default(null)`.** O `default(null)` faz
   registro antigo sem o campo passar como `null`. Nos ramos sem a obrigação
   isso é correto. Nos ramos **com** a obrigação, todo registro já existente
   passa a ser inválido de uma vez. Não há dados reais ainda, então hoje não
   quebra nada — mas é compatibilidade comprada com dívida futura. O
   `default(null)` deveria existir, ou o campo deveria ser obrigatoriamente
   explícito?

2. **Testemunho em ramo que não documenta testemunho gera aviso, não erro.** Meu
   raciocínio: informação a mais não é mentira. Contra-argumento que não sei
   descartar: é dado que nenhuma regra governa, e dado não governado apodrece.

3. **Âncora não cruza capítulo.** `anchorsOverlap` devolve `false` quando
   `left.chapter !== right.chapter`, e a âncora tem um único `chapter`:

   ```ts
   export function anchorsOverlap(left: PassageAnchor, right: PassageAnchor): boolean {
     if (!sameSystem(left, right) || left.book !== right.book || left.chapter !== right.chapter) return false;
     return left.verseStart <= right.verseEnd && right.verseStart <= left.verseEnd;
   }
   ```

   Logo **Gênesis 1:31–2:3 não é representável como uma âncora**. Para uma
   árvore de conhecimento bíblico isso me parece limitação real — perícopes
   atravessam capítulo com frequência, e a divisão em capítulos é medieval, não
   original. Eu não corrigi porque mudaria o tipo primitivo de toda a frente.
   **Esta é, na minha avaliação, a questão de modelagem mais séria do
   documento.** Quero contestação.

4. **`treeIsEmpty` → `not_published` com a árvore anexada.** Recusa que vem
   acompanhada do objeto recusado é incomum. Minha razão: a árvore vazia explica
   *por que* está vazia (quais ramos, quantos `withheld`). Isso é bom desenho ou
   é um `ok: false` que mente sobre ser falha?

5. **`anchorsOverlap` para decidir `fora_da_passagem`.** Usei sobreposição, não
   continência. Evidência ancorada em Gn 1:1–5 aparece ao consultar Gn 1:3. Acho
   correto, mas é escolha, e não foi discutida com ninguém.

6. **Dez exports mortos** que a revisão encontrou e eu **não** removi, por falta
   de autorização: `approvedVersifications`, `anchorContains`, `claimsAnchoredAt`,
   `connectionsFrom`, `evidenceBranches`, `byText`, `duplicateIds`,
   `validateSourceWork`, `validateSourceArtifact`, `readingLabel`.
   **Um deles é armadilha de verdade:** `connectionsFrom` monta a chave da âncora
   com template string à mão, em vez de chamar `anchorKey` — duplica, pior, o que
   `projectPassageTree` agora faz corretamente. Quem chegar depois encontra duas
   respostas, e a errada é mais fácil de achar. Minha recomendação é apagá-lo.
   Concorda?

7. **Linhas como `unknown` na porta do repositório.** Defensivo de propósito, mas
   joga erro de tipo para tempo de execução. Vale a troca?

---

## 10. Como devolver

Para cada item, uma linha. Não precisa de prosa.

```
§4.1  confere | não confere: <contraexemplo> | insuficiente: <o que falta>
§4.2  ...
§5    ...
§9.1  ...
§9.3  ...
```

E, no fim, **uma** frase respondendo: **o aceite da fila está cumprido, ou não
está?** Se não está, qual critério falta — usando a redação da fila
("relações tipadas, proveniência/localização obrigatória, estados de revisão
explícitos e testes que recusam evidência sem fonte/localização"), não outra.

Se discordar de algo que eu afirmei como fato — número de teste, comportamento de
código, o que a fila pediu — diga, porque fato errado aqui contamina tudo abaixo.
