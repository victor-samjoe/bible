# Claude 2 — revisão e fila do grafo de conhecimento

## Retorno da avaliação independente — 24/11/2026

Documento analisado: `tasks/product/knowledge-graph-001-validacao.md`. O agente
principal releu os pontos listados abaixo e executou os dois arquivos de teste
da frente: **60 testes passaram**. Isso verifica a suíte, não cada afirmação
do relatório nem uma integração com banco real.

- §4.1/§4.2: há imposição de `requiresWitness` e validações de testemunho no
  código. A associação de fonte e localização tem cobertura na suíte; a
  suficiência de todos os casos adversariais ainda merece exame.
- §5: a projeção filtra registros por publicação e direitos e registra motivos;
  a afirmação de que nenhum conteúdo não publicado pode vazar por `details`,
  identificadores ou mensagens de erro ainda precisa de teste adversarial.
  `interpretive: boolean` informa o consumidor, mas sozinho não obriga uma
  interface futura a exibir um rótulo.
- §9.1: `default(null)` é uma escolha de compatibilidade; não há evidência de
  dados reais que imponha uma mudança imediata. Testar os ramos obrigatórios.
- §9.2: o aviso para testemunho em outro ramo existe. Não promover a erro sem
  antes definir o contrato e verificar os usos; apresentar opções com testes.
- §9.3: a âncora atual tem um capítulo só; uma perícope que atravessa capítulos
  não cabe em uma única âncora. Registrar e propor solução compatível; não
  alterar a representação pública ou versificação sem decisão de produto.
- §9.4: `not_published` acompanhado de árvore explicativa existe. Sua segurança
  depende de verificar que metadados e erros não revelem conteúdo retido.
- §9.5: **há divergência real**. Afirmações e posições usam `anchorsOverlap`,
  mas `evidenceAnchoredAt` compara `anchorKey` por igualdade. Logo, uma evidência
  em Gn 1:1–5 não aparece ao consultar Gn 1:3, apesar do exemplo do relatório.
  Isso também pode reter afirmações dependentes. A política correta entre
  igualdade, sobreposição e continência precisa ser explícita e testada.
- §9.6: `connectionsFrom` duplica a montagem da chave; hoje o formato coincide
  com `anchorKey`. Isso é duplicação frágil, não foi provado resultado incorreto
  no formato atual. Reutilize a função comum se um teste demonstrar equivalência
  e sem alterar o contrato de direção. Não remova outros exports só por estarem
  sem uso; primeiro verifique consumidores.
- §9.7: `unknown` na fronteira é defensivo e apropriado para entrada não
  confiável; mantenha validação de runtime. Tipos internos podem ser mais
  específicos depois da validação, sem confiar no banco implicitamente.

**Aceite da A2:** os quatro critérios literais têm implementação e testes;
não considero a revisão funcional encerrada enquanto a divergência de §9.5 e
o teste de vazamento não forem resolvidos ou a política for documentada com
evidência. Não confundir esse aceite local com uma UI ou dados publicados.

## Fila sequencial para trabalho autônomo

O proprietário autorizou uma sequência de trabalho local. Execute uma tarefa
por vez; ao terminar cada item, execute os testes relevantes, anote os arquivos,
resultados e limitações e passe ao próximo. Se houver bloqueio real ou decisão
editorial, registre-o e prossiga para itens independentes. Depois de chegar ao
último item, volte à lista de pendências encontradas, priorize defeitos com
evidência e repita o ciclo **somente enquanto houver trabalho local concreto**.
Quando a lista estiver vazia, pare e entregue o relatório; não crie trabalho
artificial nem execute um loop infinito.

### 1. Semântica de evidência por intervalo

Reproduza a divergência em §9.5 com testes de borda: consulta individual dentro
de intervalo, fora dele, contato nas extremidades, outro livro/capítulo e outra
versificação. Inclua afirmação dependente e conexões. Documente a política
escolhida e implemente-a coerentemente no domínio e na projeção, sem supor que
uma evidência ampla prova cada afirmação específica. Se a escolha exigir
decisão editorial, entregue as alternativas e mantenha comportamento seguro.

### 2. Segurança de conteúdo retido

Teste registros inválidos, rascunhos e fontes sem direitos com texto e
identificadores controlados nas várias estruturas e mensagens Zod. Examine
`tree`, `withheld`, `details` e o retorno `not_published`; nenhuma citação,
resumo, tese ou dado não autorizado pode aparecer por erro ou metadado.
Corrija vazamentos comprovados sem remover a explicação útil do motivo. Teste
que dados publicados e permitidos continuam visíveis.

### 3. Referências e revisão

Teste testemunho obrigatório, testemunho ausente no índice, edição intermediária
ausente, evidência não publicada ou retraída e dependências entre afirmação,
posição e conexão. Procure registros duplicados que possam trocar a identidade
de fonte ou testemunho silenciosamente; falhe fechado quando necessário.
Verifique a correspondência de `connectionsFrom` com `anchorKey`, intervalos e
direção; elimine a duplicação sem remover API usada por terceiros.

### 4. Passagens que atravessam capítulos

Faça uma pequena análise de modelagem usando Gn 1:31–2:3 como exemplo e proponha
uma representação por múltiplas âncoras ou outra alternativa compatível,
incluindo versificação, citações, ordenação e efeitos sobre a API existente.
Entregue exemplos e testes de contrato quando a solução não exigir decisão
editorial. Não invente uma versificação nem faça alteração incompatível sem
decisão registrada do proprietário.

### 5. Revisão de integração e próxima prova vertical

Prepare um plano executável para o repositório real e a prova de Gn 1:1,
explicitando dependências de C29, direitos, dados e custo. Use fixtures
claramente identificadas para demonstrar o fluxo se útil. Avalie tamanho e
índices para o plano gratuito do Supabase; não crie schema remoto nem importe
corpus. Não conclua que uma fonte é aprovada ou que conteúdo já está publicado.

### 6. Verificação e passagem

Execute testes focados, lint dos arquivos alterados e typecheck; rode a suíte
geral se o ambiente permitir. Registre o que passou, falhas com reprodução,
decisões pendentes, arquivos alterados e próximos passos para revisão. Não
marque uma frente como concluída só porque um teste passou ou por faltar tempo.

## Limites e áreas reservadas

Escopo de escrita: `src/domain/knowledge-graph/**`,
`src/server/knowledge-graph/**`, `tests/domain/knowledge-graph*`,
`tests/server/knowledge-graph*`, `docs/VERSE_KNOWLEDGE_GRAPH.md` e relatórios
próprios `tasks/product/knowledge-graph*` ou este arquivo. Dados de teste devem
ser locais e claramente rotulados. Não mexer na frente lexical, nos scripts de
shards ou no painel do Claude 1; não alterar `app/progresso/**` ou testes de
progresso enquanto sua validação estiver sem conclusão registrada.

Sem rede, sem alterar `.env*`, sem banco remoto ou migrations remotas, sem
commit, push ou deploy. Use banco local descartável apenas quando necessário.
Preserve arquivos e processos de outros agentes. O agente principal revisará e
separará commits após o trabalho.
