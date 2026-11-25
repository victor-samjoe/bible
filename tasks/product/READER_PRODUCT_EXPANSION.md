# Expansão do produto — leitura, estudo e ferramentas

> Revisão local de 24/11/2026: os estados “Planejada” abaixo não refletem todo
> o código existente. `READING-COMPLETE-001`, `READING-PROGRESS-001` e
> `KNOWLEDGE-GRAPH-001` têm implementação local e aguardam aceite;
> `ALIGNMENT-PIPELINE-001` tem implementação local e está em execução.
> Consulte a fila operacional para o estado e as pendências.


Criado em 19/11/2026 a partir das referências visuais enviadas pelo proprietário. As imagens são
referência de função e equilíbrio, não licença para copiar identidade, textos ou elementos do outro
produto. A experiência da Bíblia Bereana deve continuar simples e editorial.

## Ordem de execução

| ID | Prioridade | Entrega | Estado | Dependências principais |
| --- | --- | --- | --- | --- |
| `ORIGINAL-READER-001` | P0 | Consulta server-side de hebraico/grego por seleção, limitada e com atribuição | Implementada e testada localmente | migration 0005 |
| `ORIGINAL-IMPORT-001` | P0 | Importador idempotente dos manifestos já verificados | Concluída e importada em 19/11/2026 | fontes aprovadas em 19/11/2026 |
| `ORIGINAL-READER-002` | P0 | Exibir texto original aprovado na ação do leitor | Implementada; aguarda publicação do código | duas anteriores |
| `READING-COMPLETE-001` | P1 | Marcar/desmarcar capítulo no fim da leitura, além do menu | Planejada | progresso já persistido |
| `READING-PROGRESS-001` | P1 | Página “Leituras realizadas” por testamento, livro e capítulo | Planejada | conta + `chapter_reading_progress` |
| `THEMES-001` | P1 | Índice e busca de estudos por tema com fontes editoriais | Planejada | catálogo editorial |
| `AI-EXEGESIS-001` | P1 | Agente de interpretação/exegese chamado sobre uma seleção | Descoberta necessária | provedor, custo e política editorial |
| `AUDIO-001` | P2 | Player e catálogo de áudio por capítulo/livro | Descoberta necessária | fonte, licença, voz e custo |
| `READER-TOOLS-001` | P2 | Hub compacto para histórico, favoritos, notas, temas e originais | Planejada | funcionalidades reais correspondentes |
| `PROFILE-REFINE-001` | P2 | Perfil compacto com atalhos pessoais úteis | Planejada | progresso/temas/agente |
| `KNOWLEDGE-GRAPH-001` | P0 | Ontologia, âncoras e relações da árvore por passagem | Planejada | `docs/VERSE_KNOWLEDGE_GRAPH.md` |
| `STUDY-DOCUMENT-001` | P1 | Notas estruturadas transformáveis em estudo versionado e citável | Planejada | grafo + conta |
| `VULGATE-001` | P1 | Prova vertical da Vulgata: edição latina, direitos, versificação e contexto | Descoberta necessária | grafo + revisão de direitos |
| `LXX-001` | P1 | Septuaginta para testemunho grego do AT, com edição, direitos e versificação | Descoberta necessária | grafo + revisão de direitos |
| `ALIGNMENT-001` | P0 | Alinhamentos editoriais palavra/grupo entre tradução e testemunhos | Prova vertical em Gênesis 1:1 | originais aprovados |
| `LEXICON-INDEX-001` | P0 | Léxico indexado por lema, reutilizável em todas as ocorrências | Coletado, verificado e importado em Postgres descartável; migration/importação de produção ainda exigem ordem operacional | MACULA + OS HebrewLexicon + STEPBible |
| `ALIGNMENT-PIPELINE-001` | P0 | Tokenizar qualquer tradução e gerar candidatos de alinhamento versionados | Planejada | léxico + versão bíblica importada |
| `RECEPTION-HISTORY-001` | P1 | Autores/obras/interpretações históricas com evidência localizável | Planejada | BKF + grafo |
| `RESEARCH-AGENT-001` | P1 | Agente de pesquisa que gera cartões citáveis para estudos | Planejada | acervo aprovado + estudo estruturado |
| `PRO-ENTITLEMENTS-001` | P2 | Limites Livre/Pro para acervo e computação, sem bloquear leitura básica | Decisão comercial | conteúdo e agente validados |

## Critérios resumidos

### ORIGINAL-IMPORT-001

- Só aceita os manifestos e checksums documentados em `docs/ORIGINAL_LANGUAGE_SOURCES.md`.
- Reexecução não duplica edição, versículo, token, lema nem morfema.
- Aprovação exige pessoa responsável e data; não pode ser presumida pelo script.
- Importação do SBLGNT não cria morfologia; MorphHB não cria glossa, tradução ou Strong.
- Primeiro validar em Postgres descartável; aplicação remota exige ordem explícita.

### READING-COMPLETE-001 e READING-PROGRESS-001

- Inserir ação discreta ao final do capítulo, sem remover a ação existente.
- Página mostra números reais da conta e nunca inventa percentuais.
- Permitir abrir o capítulo e corrigir marcação individual; reinício total exige confirmação forte.
- Visitante recebe estado local claramente identificado, sem promessa de sincronização.

### THEMES-001

- Tema precisa de slug, título, resumo editorial, referências canônicas e fontes publicadas.
- Busca por nome/sinônimo e lista alfabética; sem conteúdo preenchido por IA silenciosamente.
- Cada estudo diferencia texto bíblico, comentário editorial e contribuição de IA.

### AI-EXEGESIS-001

- Entrada: seleção explícita, versão exibida e, quando liberado, original aprovado.
- Saída separa observação textual, contexto histórico, possibilidades interpretativas e aplicação.
- Cita as fontes efetivamente consultadas e informa tradição/limites; não apresenta consenso falso.
- IA nunca inventa original, aparato, lema ou referência; falha fechada sem fonte.
- Antes de implementar: escolher provedor/modelo, orçamento, retenção, moderação e política de dados.

### KNOWLEDGE-GRAPH-001, VULGATE-001 e RECEPTION-HISTORY-001

- Usar `docs/VERSE_KNOWLEDGE_GRAPH.md` como vocabulário inicial.
- Âncora canônica não depende de uma tradução; mapas de versificação são explícitos e versionados.
- Vulgata latina e tradução portuguesa são ativos separados, com direitos separados.
- Interpretação histórica exige autor, obra, edição, localização e evidência; uma lista de nomes não basta.
- Executar prova vertical pequena em Gênesis 1:1 antes de ampliar o catálogo.
- Grego do AT é Septuaginta (`LXX-001`), não SBLGNT; cada edição mantém sua natureza histórica.
- `ALIGNMENT-001` liga grupos revisados, não palavras pela posição: uma palavra hebraica pode corresponder a duas ou mais em português.

### LEXICON-INDEX-001 e ALIGNMENT-PIPELINE-001

- A unidade lexical é o **lema**, não o versículo. Definição, transliteração e campo semântico são importados uma vez e reutilizados em todas as ocorrências daquele lema.
- Cada ocorrência conserva apenas token, morfologia, referência, edição e eventual sentido contextual; não duplica o verbete lexical.
- O script recebe `translation_id` e `original_edition_id`, tokeniza a versão escolhida e produz candidatos de alinhamento com método, confiança e versão do algoritmo.
- O núcleo lexical é independente da tradução. O alinhamento não pode ser totalmente independente, porque versões traduzem, omitem, explicitam e reorganizam palavras de modos diferentes.
- Alinhamentos automáticos são candidatos: confiança alta pode ser publicada segundo política aprovada; ambíguos entram em fila editorial. Nunca associar simplesmente pela posição.
- Reprocessamento é idempotente e cria nova versão do alinhamento quando texto, edição, léxico ou algoritmo mudar.
- A UI consulta banco/API; nenhum verbete completo ou mapa de 31 mil versículos fica codificado em componente React.
- A prova de Gênesis 1:1 em `src/domain/word-analysis.ts` é temporária e deve ser substituída por esta pipeline após a fonte lexical ser licenciada e importada.
- **Execução atualizada em 19/11/2026**: as quatro fontes do MVP foram coletadas por commit e SHA-256, o índice integral foi gerado e a migration/importação foram comprovadas em Postgres descartável. O painel já consulta a API lexical de forma progressiva; aplicar em produção continua sendo uma decisão operacional separada. Estado e portões em `tasks/product/LEXICON-INDEX-001-preparacao.md` e `docs/LEXICON_PIPELINE.md`.
- O `Meaning` do TBESH é proibido por nome no registro e a leitura falha fechada se a coluna aparecer; a definição hebraica vem do Open Scriptures HebrewLexicon.

### STUDY-DOCUMENT-001 e RESEARCH-AGENT-001

- Estudo versionado combina observação própria, cartões de evidência, comparação e síntese rotulada.
- Agente mostra evidências antes da síntese e só insere conteúdo na nota mediante ação do usuário.
- Bibliografia é gerada dos metadados persistidos; o modelo não inventa referência de memória.
- Conteúdo pessoal é privado por padrão e não alimenta o acervo coletivo sem consentimento explícito.

### PRO-ENTITLEMENTS-001

- Leitura bíblica básica e acesso aos próprios dados não dependem de assinatura.
- Cobrar por curadoria, busca cruzada, conexões, computação, dossiês e limites maiores.
- Não apresentar corpus em domínio público/CC como propriedade exclusiva da plataforma.

### AUDIO-001

- Não sintetizar nem distribuir áudio antes de decidir licença e atribuição da edição textual.
- Player conserva capítulo, posição, velocidade e controles acessíveis.
- Download/offline é uma permissão separada de streaming.

### READER-TOOLS-001 e PROFILE-REFINE-001

- Mostrar apenas ferramentas implementadas; nada de cartões vazios ou números fictícios.
- Priorizar retomar leitura, progresso, notas, destaques, temas e histórico.
- Grade compacta em celular e desktop, seguindo o mesmo shell do produto.

## Fora do escopo desta criação de tarefas

- copiar anúncios, loja, doações ou assinaturas do aplicativo de referência;
- escolher fonte de áudio ou provedor de IA sem análise de direitos/custo;
- aplicar migrations no Supabase ou liberar corpora sem aprovação;
- publicar ou fazer deploy automaticamente.
