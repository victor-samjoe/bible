# KNOWLEDGE-GRAPH-001 — itens 1 e 2 da fila do grafo

**Fila:** `tasks/product/CLAUDE2_FILA_GRAFO_NOITE.md`.
**Data:** 25/11/2026.
**Estado:** itens 1 e 2 concluídos; 3 a 6 pendentes.

A avaliação externa condicionou o aceite funcional a dois pontos: resolver a
divergência de §9.5 e provar por teste adversarial que conteúdo retido não vaza.
Os dois estão feitos. Este registro diz o que mudou, o que foi provado e o que
ficou aberto — incluindo um defeito **novo**, encontrado durante o item 2.

---

## 1. Semântica de evidência por intervalo

### O que estava errado

A avaliação estava certa e eu estava errado. O documento anterior afirmava que
evidência ancorada em Gênesis 1:1–5 aparecia ao consultar 1:3. Não aparecia.
Havia **três políticas de comparação na mesma travessia**:

| Registro | Política anterior |
| --- | --- |
| evidência | `evidenceAnchoredAt` → igualdade de chave |
| afirmação | `anchorsOverlap` → sobreposição |
| posição | sobreposição na projeção, **igualdade** na validação |
| conexão | igualdade de chave |

O efeito é pior do que "material invisível". O índice de evidência é montado
**depois** do filtro por igualdade, então uma afirmação publicada e correta,
ancorada em 1:3 e apoiada em evidência de 1:1–5, era recusada como **`invalido`**
com a mensagem *"evidência não está registrada"* — enquanto a evidência existia,
estava publicada e tinha direitos liberados. A camada acusava o dado bom de um
defeito que era dela.

A igualdade também produzia **erro duro**, não aviso, em dois contratos:
`position.anchors` (`claims.ts:227`) e `connection.evidenceId`
(`connections.ts:71`). Dado legítimo recusado por política de comparação.

### Política adotada

1. **Sobreposição decide pertinência.** Material ancorado num intervalo é
   alcançado por consulta a qualquer versículo dele. Igualdade de chave tornava
   a âncora de intervalo inalcançável na prática: ninguém consulta "1:1–5".
2. **A escala fica visível.** Pertencer não é equivaler. Cada cartão carrega
   `scope`, com as âncoras que tocam a consulta, a referência legível e
   `broaderThanQuery`. Sem isso a árvore sugeriria precisão de versículo que o
   registro não tem — a objeção que a avaliação levantou ao incluir por
   sobreposição.
3. **Sistema diferente nunca sobrepõe.** `anchorsOverlap` já recusa cânon ou
   versificação distintos, então número igual continua não sendo passagem igual.

Não é decisão editorial: não inventa versificação, não altera conteúdo e não
muda a representação pública da âncora.

### Mudanças

- `src/domain/knowledge-graph/evidence.ts` — `evidenceAnchoredAt` passa a usar
  `anchorsOverlap`. Como `claims.ts`, `connections.ts` e a projeção todos
  chamam esse predicado, a política ficou uniforme por **uma** mudança, em vez
  de quatro comparações soltas.
- `src/server/knowledge-graph/tree.ts` — o filtro de conexões deixa de comparar
  chave exata; tipo `CardScope` e função `scopeOf`; campo `scope` nos quatro
  cartões (evidência, afirmação, posição, conexão).

### Provas

`tests/domain/knowledge-graph-intervals.test.ts` (novo, 12 testes) e quatro
testes novos em `tests/server/knowledge-graph.test.ts`. Antes da correção o
arquivo de intervalos falhava em **4** dos 12, exatamente nos pontos da
divergência; os 8 que já passavam fixam o que não devia mudar.

Bordas cobertas, como a fila pediu: versículo dentro do intervalo; extremidades
(1:1 e 1:5 dentro, 1:6 fora); livro diferente; capítulo diferente; versificação
diferente (Miqueias 5:1 hebraico continua sem sobreposição com o português);
escalas iguais; sobreposição distinguida de continência nos dois sentidos.
Dependências cobertas: afirmação, posição e conexão apoiadas em evidência de
intervalo, mais os casos simétricos que **devem** continuar recusados.

E o caso que originou tudo: `não acusa de inválida a afirmação cuja evidência é
de intervalo`, que verifica também que a cadeia "não está registrada" não
aparece no relatório de recusa.

---

## 2. Segurança de conteúdo retido

### Método

Canário, não inspeção. `tests/server/knowledge-graph-leak.test.ts` (novo, 7
testes) põe cadeias únicas e improváveis em **todo** campo de conteúdo de
registros que a camada deve retor — citação, resumo, afirmação, tese, razão,
disputa, divergência, base de confiança e nota — e depois serializa a árvore
inteira, o `withheld`, cada `details` e o retorno do leitor, procurando cada
canário. Canário encontrado seria vazamento provado.

Pacote hostil montado com as quatro classes de recusa ao mesmo tempo: rascunho,
registro inválido por contrato, campo de conteúdo com tipo errado e fonte com
licença que não libera uso — mais registros bons e publicados na mesma consulta,
para provar que a recusa é seletiva e não um "esconde tudo".

### Resultado

**Nenhum canário vazou**, em nenhuma das sete rotas testadas, incluindo:

- o relatório de recusa e cada `details` separadamente;
- o retorno `not_published` do leitor, quando só há material retido;
- proveniência inválida derrubando o que depende dela;
- canário posto num campo que o schema **recusa** — o caso mais afiado, porque
  o valor rejeitado vira mensagem Zod.

Essa última rota fica provada, e não só argumentada: as mensagens do Zod 4 nesta
base listam as opções **esperadas** (`Invalid option: expected one of "…"`), sem
ecoar o valor recebido. E `schemaCollector` (`tree.ts:257`) mapeia apenas
`issue.path` e `issue.message` — o objeto `issue`, que carrega `input`, nunca é
serializado. A garantia é estrutural, não acidental.

Também fica provado que a recusa **continua útil**: o motivo do rascunho nomeia
o estado (`rascunho`) e o do registro inválido nomeia o campo (`locator`), sem
citar o texto.

### Defeito novo, encontrado aqui

O motivo `direitos_nao_liberados` da projeção **nunca dispara para evidência**.
`validateEvidence` já dobra `rightsPublicationErrors` quando recebe o índice de
proveniência (`evidence.ts:261‑265`), e a projeção sempre passa o índice. Então
toda recusa por licença chega rotulada como `invalido`, que culpa o registro em
vez da licença — mesma classe de problema que a §9.5: código de motivo que
acusa a coisa errada.

Gravidade: baixa, porque **a causa não se perde** — os detalhes nomeiam a
licença (`"a licença de … não permite citação literal"`). É o rótulo que é
grosseiro, não a informação.

Não corrigi, e o motivo é deliberado: distinguir os dois casos exige erro
**tipado** no domínio (o contrato devolvendo a categoria do erro), não farejar
mensagem na camada de leitura. Farejar texto de mensagem criaria acoplamento
pior do que o rótulo impreciso que corrigiria. Fica registrado em teste, que
pina o comportamento de hoje e explica por que ele é como é.

Outra observação da mesma classe, menor: evidência cuja **edição** foi recusada
aparece como `invalido` com *"edição … não está registrada"*. A edição está na
entrada; foi rejeitada. O `withheld` traz o registro da edição com o motivo real,
então a informação existe na saída — mas a mensagem da evidência é literalmente
falsa.

---

### Teste de mutação do próprio teste de vazamento

Um teste de vazamento que não consegue falhar não prova nada. Mutei a projeção
para vazar de propósito — `details` do rascunho passando a carregar
`JSON.stringify(evidence.content)` — e **2 testes falharam**, nomeando o canário
encontrado. Mutação revertida e a reversão provada por `diff` contra cópia
anterior; as 83 voltaram a passar.

A mutação rendeu também uma confirmação útil: no despejo da árvore mutada, o
`details` do campo com tipo errado traz `"evidence.content.quotation: Invalid
input: expected string, received number"` — sem o valor. É o Zod descrevendo o
tipo, não ecoando o dado.

---

## 3. Verificações

Executadas em 25/11/2026, 04:20–04:22.

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | limpo nos arquivos desta frente |
| `npx eslint` (domínio + servidor + 4 suítes) | zero erros, zero avisos |
| suítes da frente | **83/83** em 4 arquivos (eram 60 em 2) |
| suíte completa | **475 passaram, 7 ignorados**, 48 arquivos |

Dois pontos de honestidade sobre o ambiente, nenhum desta frente:

- `tests/scripts/lexicon-genesis1-slice.test.ts` tem erro TS7016 (módulo `.mjs`
  sem declaração). É da frente do Claude 1, fora do meu escopo; não toquei.
- `npx tsc --noEmit` também acusa três arquivos ausentes em `.next/types`,
  porque um processo paralelo limpou o diretório gerado. Transitório, não é
  código.

Os 7 testes ignorados e o arquivo ignorado não são meus.

---

## 4. O que falta na fila

| Item | Estado |
| --- | --- |
| 1. Semântica de intervalo | **feito** |
| 2. Conteúdo retido | **feito** |
| 3. Referências e revisão | pendente |
| 4. Passagens que atravessam capítulos (Gn 1:31–2:3) | pendente |
| 5. Plano de integração e prova vertical de Gn 1:1 | pendente |
| 6. Verificação e passagem | parcial — portões rodados, relatório final pendente |

Decisões pendentes de outra pessoa, não minhas: a classificação tipada de erro
(defeito acima), a remoção dos exports mortos — a fila manda verificar
consumidores antes, e eu não verifiquei — e tudo que depende de C29.

Nada foi feito fora de `src/domain/knowledge-graph/**`,
`src/server/knowledge-graph/**`, `tests/{domain,server}/knowledge-graph*` e
`tasks/product/knowledge-graph*`. Sem rede, sem `.env*`, sem banco remoto, sem
migration, sem commit, push ou deploy.
