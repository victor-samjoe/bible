# BKR — dossiês de contexto dos livros bíblicos

Status: planejamento editorial; nenhum dossiê desta lista está aprovado ou publicado.
Âmbito: Bíblia Bereana / Bereianos Knowledge Repository (BKR), como insumo consultável pelo BKF e pelo leitor. Este backlog não autoriza que agentes inventem, publiquem ou apresentem como consenso informações não verificadas.

## Objetivo

Para cada livro bíblico, produzir um dossiê curto, versionado e rastreável que alimente o botão **Contexto** do leitor. O dossiê explica o cenário de leitura sem substituir o texto bíblico nem uma análise acadêmica integral.

Cada informação deve ser classificada como:

- **Consenso editorial** — informação com fontes acadêmicas/edições de referência convergentes;
- **Posição atribuída** — tradição, hipótese ou interpretação identificada com a fonte que a sustenta;
- **Incerteza relevante** — autoria, datação, destinatário ou gênero debatidos, sem falsa precisão;
- **Lacuna** — ainda sem fonte ou sem revisão; não é exibida ao leitor como fato.

## Fonte, direitos e revisão

1. Usar obras de referência com edição, URL/identificador, consulta e trecho/localização registrados. Uma fonte pública não elimina o dever de verificar sua licença.
2. Não copiar textos longos: a interface usa síntese original revisada e referências. Qualquer citação segue os direitos e limites do BKF.
3. Um redator prepara `DRAFT`; um revisor teológico/editorial confere fontes e linguagem; somente uma pessoa responsável promove `APPROVED`.
4. Cada mudança cria nova versão; o leitor exibe apenas a versão aprovada e sua data de revisão.
5. O conteúdo deve dizer quando há debate. Não atribuir autor, data ou destinatários com certeza maior do que a evidência permite.

## Contrato do dossiê

O artefato segue o modelo em `data/templates/bkr-book-context.template.json`.

| Campo | Uso no leitor | Regra |
| --- | --- | --- |
| `book` | vínculo canônico (`slug`, nome, testamento, ordem) | obrigatório |
| `summary` | tooltip/resumo do botão Contexto | 1–3 frases, linguagem clara |
| `authorship` | autor/tradição e grau de certeza | distinguir atribuição de consenso |
| `dating` | faixa/época e justificativa | nunca data precisa sem fonte |
| `audience` | destinatários e situação | declarar incerteza quando houver |
| `historical_context` | cenário histórico-literário | síntese com fontes |
| `purpose` | propósito/ocasião | hipótese identificada quando debatida |
| `major_themes` | temas para descoberta | termos curtos, não claims absolutos |
| `literary_outline` | organização em alto nível | opcional, não inventar perícope |
| `sources` | evidência consultável | obrigatório antes de aprovação |
| `review` | autoria editorial, estado e versão | obrigatório |

## Fluxo CLI proposto

```text
# 1. criar dossiê de rascunho a partir do modelo, sem preencher fatos por IA
npm run bkr:book-context -- init --book genesis

# 2. validar estrutura, fontes, estado e campos obrigatórios
npm run bkr:book-context -- validate data/bkr/book-context/genesis.json

# 3. gerar prévia local para revisão humana (não publica)
npm run bkr:book-context -- preview data/bkr/book-context/genesis.json

# 4. após revisão identificada, promover versão aprovada
npm run bkr:book-context -- approve data/bkr/book-context/genesis.json --reviewer <id>
```

Esses comandos são a especificação do futuro CLI; não devem ser anunciados como implementados antes de existirem, com testes. A implementação deve reutilizar os contratos BKF de fontes, direitos, revisão e auditoria.

## Matriz de trabalho — 66 dossiês

Cada linha começa em `NOT_STARTED` e precisa passar por `DRAFT → SOURCED → REVIEWED → APPROVED`. A ordem sugerida prioriza o leitor e não indica prioridade teológica.

### Antigo Testamento

| Código | Livro | Estado |
| --- | --- | --- |
| OT-01 | Gênesis | NOT_STARTED |
| OT-02 | Êxodo | NOT_STARTED |
| OT-03 | Levítico | NOT_STARTED |
| OT-04 | Números | NOT_STARTED |
| OT-05 | Deuteronômio | NOT_STARTED |
| OT-06 | Josué | NOT_STARTED |
| OT-07 | Juízes | NOT_STARTED |
| OT-08 | Rute | NOT_STARTED |
| OT-09 | 1 Samuel | NOT_STARTED |
| OT-10 | 2 Samuel | NOT_STARTED |
| OT-11 | 1 Reis | NOT_STARTED |
| OT-12 | 2 Reis | NOT_STARTED |
| OT-13 | 1 Crônicas | NOT_STARTED |
| OT-14 | 2 Crônicas | NOT_STARTED |
| OT-15 | Esdras | NOT_STARTED |
| OT-16 | Neemias | NOT_STARTED |
| OT-17 | Ester | NOT_STARTED |
| OT-18 | Jó | NOT_STARTED |
| OT-19 | Salmos | NOT_STARTED |
| OT-20 | Provérbios | NOT_STARTED |
| OT-21 | Eclesiastes | NOT_STARTED |
| OT-22 | Cântico dos Cânticos | NOT_STARTED |
| OT-23 | Isaías | NOT_STARTED |
| OT-24 | Jeremias | NOT_STARTED |
| OT-25 | Lamentações | NOT_STARTED |
| OT-26 | Ezequiel | NOT_STARTED |
| OT-27 | Daniel | NOT_STARTED |
| OT-28 | Oséias | NOT_STARTED |
| OT-29 | Joel | NOT_STARTED |
| OT-30 | Amós | NOT_STARTED |
| OT-31 | Obadias | NOT_STARTED |
| OT-32 | Jonas | NOT_STARTED |
| OT-33 | Miqueias | NOT_STARTED |
| OT-34 | Naum | NOT_STARTED |
| OT-35 | Habacuque | NOT_STARTED |
| OT-36 | Sofonias | NOT_STARTED |
| OT-37 | Ageu | NOT_STARTED |
| OT-38 | Zacarias | NOT_STARTED |
| OT-39 | Malaquias | NOT_STARTED |

### Novo Testamento

| Código | Livro | Estado |
| --- | --- | --- |
| NT-01 | Mateus | NOT_STARTED |
| NT-02 | Marcos | NOT_STARTED |
| NT-03 | Lucas | NOT_STARTED |
| NT-04 | João | NOT_STARTED |
| NT-05 | Atos | NOT_STARTED |
| NT-06 | Romanos | NOT_STARTED |
| NT-07 | 1 Coríntios | NOT_STARTED |
| NT-08 | 2 Coríntios | NOT_STARTED |
| NT-09 | Gálatas | NOT_STARTED |
| NT-10 | Efésios | NOT_STARTED |
| NT-11 | Filipenses | NOT_STARTED |
| NT-12 | Colossenses | NOT_STARTED |
| NT-13 | 1 Tessalonicenses | NOT_STARTED |
| NT-14 | 2 Tessalonicenses | NOT_STARTED |
| NT-15 | 1 Timóteo | NOT_STARTED |
| NT-16 | 2 Timóteo | NOT_STARTED |
| NT-17 | Tito | NOT_STARTED |
| NT-18 | Filemom | NOT_STARTED |
| NT-19 | Hebreus | NOT_STARTED |
| NT-20 | Tiago | NOT_STARTED |
| NT-21 | 1 Pedro | NOT_STARTED |
| NT-22 | 2 Pedro | NOT_STARTED |
| NT-23 | 1 João | NOT_STARTED |
| NT-24 | 2 João | NOT_STARTED |
| NT-25 | 3 João | NOT_STARTED |
| NT-26 | Judas | NOT_STARTED |
| NT-27 | Apocalipse | NOT_STARTED |

## Critérios de aceite por livro

- Identificador canônico e versão do artefato válidos.
- Resumo legível em tela pequena, sem afirmações não qualificadas.
- Ao menos duas fontes registradas quando o tema for debatido, ou uma fonte primária/edição de referência e a lacuna expressa.
- Autoria, datação, público e propósito distinguem tradição, hipótese e consenso.
- Revisor, data, fontes e decisões de incerteza registrados.
- Sem conteúdo protegido copiado acima dos limites permitidos.
- Validação de esquema e prévia local aprovadas antes do estado `APPROVED`.

## Próxima tarefa executável

**BKR-CONTEXT-001 — contrato e CLI de validação.** Criar schema TypeScript/Zod, `init/validate/preview` determinísticos, fixtures sem conteúdo teológico factual e testes. Não publicar no app antes de ao menos um dossiê revisado. Depois, criar um dossiê por tarefa (`BKR-CONTEXT-002` em diante), começando pelos livros mais acessados, sempre com revisão humana.
