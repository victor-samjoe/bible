# Frentes paralelas — Gênesis 1

## Claude 1 — apresentação do BDB

Revise e implemente a leitura das acepções BDB para palavras de Gênesis 1 no
painel de originais, com atribuição e localização da fonte, preservando os
homógrafos e a estrutura hierárquica. A ausência de dado deve ser mostrada com
estado honesto, sem inventar glossas nem expor rascunho como texto revisado.
Trabalhe em `src/server/lexicon/**`, `app/api/biblia/lexico/**`,
`app/biblia/original-panel.tsx` e testes diretamente correspondentes. Inclua
testes e registre dependências de schema; não aplique migrations nem importe
dados remotamente. O operador principal prepara os dados de Gênesis 1.

Ao terminar, informe os arquivos alterados, os testes executados e os bloqueios.
**Não faça commit nem deploy**: o agente principal revisará as entregas e
separará os commits depois que as duas frentes terminarem.

### Próxima tarefa do Claude 1 — preparar atualização do shard de Gênesis 1

Avaliação do agente principal: a apresentação do BDB foi implementada e os
13 testes focados de `lexicon-reader-bdb` e `lexicon-reader` passaram. Porém,
em 24/11 o shard `hbo/GEN/1` do banco de produção ainda tinha **10 campos por
linha**; o novo leitor precisa do 11º campo, `lexemeKey`. Assim, os verbetes
já importados não serão alcançados mesmo após publicar o código novo.

Prepare localmente uma atualização **somente** do shard `hbo/GEN/1`, usando
as fontes e os identificadores originais, sem inferir chave pela grafia.
Preserve conteúdo e posições dos dez campos anteriores; compare linha a linha
com o formato anterior, verifique correspondência inequívoca por identificador
de ocorrência e falhe se houver ausência, duplicidade ou divergência. Gere
hash e relatório de tamanho antes/depois, e teste idempotência em banco local
descartável. Inclua teste ponta a ponta de Gênesis 1:1 e 1:2 com os dados
limitados já preparados, e teste que a falta de BDB em outros capítulos é
tratada sem erro. Não atualize outros shards, não importe corpus completo e
não faça alteração remota; entregue o artefato e os comandos exatos para revisão
do agente principal. O banco gratuito está próximo de 296 MB de uma cota nominal
de 500 MB, por isso registre o impacto de espaço.

Arquivos permitidos: `scripts/*lexicon*shard*`, testes diretamente relacionados
e documentação desta tarefa. Não alterar `app/progresso/**` nem os arquivos
reservados ao Claude 2. Não fazer commit, push ou deploy.

### Sequência para o Claude 1 — execução noturna

O proprietário autorizou esta sequência local. Faça uma tarefa por vez, na
ordem abaixo, depois de preparar o shard de Gênesis 1. Registre o resultado de
cada uma neste arquivo ou em um relatório próprio em `tasks/product/`. Se uma
tarefa depender de dados ausentes ou decisão editorial, registre o bloqueio e
avance para a próxima que não dependa dela. Preserve as alterações existentes
de outros agentes. Não espere pela frente de progresso do Claude 2.

**1. Endurecer o recorte e a preparação de dados.** Audite
`scripts/build-lexicon-genesis1-slice.mjs` e `scripts/import-lexicon-index.ts`:
o recorte deve limitar ocorrências, verbetes, traduções e pontes BDB aos dados
alcançáveis de `GEN 1`, sem confiar apenas em `--scope`. Acrescente validação
e testes com entradas pequenas que provem rejeição de arquivo fora do recorte,
ausência de registros e inconsistências de chaves. A execução repetida deve
produzir o mesmo resultado. Não reescreva o índice completo gerado nem toque em
`data/sources/`. Escopo: esses scripts, novos auxiliares de recorte e testes
diretamente relacionados.

**2. Exercitar a consulta lexical com dados parciais.** Teste o servidor/API
com o shard antigo e o atualizado, fontes faltantes, erro na consulta BDB,
capítulos sem BDB e palavras com mais de um verbete. Garanta que uma falha
complementar não esconda o texto original e que a resposta não apresente um
rascunho como revisado. Corrija somente defeitos comprovados dentro de
`src/server/lexicon/**`, `src/domain/lexicon/**`, `app/api/biblia/lexico/**`
e testes correspondentes. Preserve fontes, estados de revisão e homógrafos.

**3. Revisar a experiência do painel lexical.** No painel de originais,
verifique navegação por teclado, nomes acessíveis, expansão da árvore BDB,
estados de carregamento/ausência/erro e leitura em viewport móvel. Use dados
locais ou fixtures declaradas, incluindo ausência de tradução e rascunho de
máquina; não crie conteúdo editorial. Corrija problemas encontrados em
`app/biblia/original-panel.tsx`, CSS diretamente associado e testes próprios.
Não altere o leitor, seus menus ou arquivos de progresso fora desse escopo.

**4. Preparar revisão de publicação.** Ao terminar, produza um relatório que
liste alterações por tarefa, comandos executados, resultados, limites de teste,
artefato e hash do shard, tamanho antes/depois e dependências para que o agente
principal possa revisar e publicar. Informe explicitamente o que só existe
localmente e o que já está no banco; não presuma publicação. Execute testes
focados, typecheck e lint dos arquivos alterados. Rode a suíte geral e o build
se o ambiente permitir; se houver falha ou concorrência, registre a evidência.

**Limites de toda a sequência:** somente processamento local e banco local
descartável; sem chamadas externas, sem alterar `.env*`, sem escrita no Supabase
ou outros serviços, sem migrations remotas, sem commit, push ou deploy. Não
atualizar shards além de Gênesis 1 nem importar o índice completo em banco. A
preparação de dados não autoriza ativar prévia de rascunho em produção. Reserve
`app/progresso/**`, `src/server/reading/progress*` e testes de progresso para o
Claude 2. Não remover nem sobrescrever arquivos ou processos de outros agentes.

## Claude 2 — validação de progresso autenticado

**Encaminhamento mais recente:** o relatório entregue por esta sessão trata da
frente A2, grafo de conhecimento. A avaliação e a nova fila sequencial estão em
`tasks/product/CLAUDE2_FILA_GRAFO_NOITE.md`. Siga aquela fila; a validação
autenticada de progresso abaixo permanece pendente e não deve ser declarada
concluída apenas pelo relatório da A2.

Valide a A3 para visitante e conta autenticada, com dados e infraestrutura de
teste isolados. Cubra marcar/desmarcar um capítulo, recarregar, isolamento entre
contas e falha do registro local após escrita na conta. Preserve notas e
destaques e verifique a confirmação antes de reiniciar. Trabalhe em
`app/progresso/**`, `src/server/reading/progress*` e testes de progresso. Não
use conta pessoal nem escreva no banco remoto; registre o resultado e limites.

Ao terminar, informe os arquivos alterados, os testes executados e os bloqueios.
**Não faça commit nem deploy**: o agente principal revisará as entregas e
separará os commits depois que as duas frentes terminarem.

Ambas as frentes devem preservar alterações existentes, evitar `.env*`, banco
remoto, commit e deploy. Elas são independentes e não alteram os scripts nem as
migrations que o operador principal usa para preparar Gênesis 1.
