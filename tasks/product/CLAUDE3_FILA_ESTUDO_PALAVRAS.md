# Claude 3 — ampliar estudo de palavras sem aumentar o Supabase

## Objetivo

O proprietário quer estudos de palavras profundos, simples e acessíveis, com
usos em toda a Bíblia, contexto e traduções. Hoje a tela `/palavra` consulta
`lexeme_occurrences`, que em produção tem somente o recorte de Gênesis 1. Não
chamar essa lista de completa. A interface do leitor e o índice relacional
integral não devem ser publicados ou importados automaticamente.

## Estado e coordenação

- Claude 1 trabalha no pacote offline BLIVRE e no leitor offline.
- Claude 2 trabalha no grafo, contexto de Gênesis e interpretações de autores.
- Esta frente prepara uma **solução independente** para localizar ocorrências
  de uma palavra no corpus aprovado sem ampliar o banco gratuito. Não alterar
  os arquivos reservados aos outros dois; não editar `app/biblia/**`,
  `app/palavra/**`, `public/sw.js`, módulos de offline ou grafo.
- As fontes lexicais e licenças estão em `docs/ORIGINAL_LANGUAGE_SOURCES.md`,
  `docs/LEXICON_PIPELINE.md` e no registro de fontes. Antes de usar material,
  verifique versão, hash, direitos e atribuição. Não supor que arquivo local
  signifique aprovação editorial ou permissão para redistribuição.

## Fila de trabalho

Execute um item por vez e registre evidências, testes, arquivos e limitações.
Quando encontrar bloqueio de direitos ou decisão editorial, registre e avance
nos itens independentes. Pare ao concluir o trabalho local autorizado.

### 1. Investigar acesso aos usos da palavra

Audite a origem dos identificadores, lemas, Strong, morfemas e referências do
índice lexical local e das edições aprovadas. Identifique quando um Strong
representa homógrafos, palavra composta, morfema funcional ou mais de uma
tradição de versificação. Não agrupe termos apenas por semelhança gráfica nem
trate Strong como garantia de um único significado. Anote lacunas de grego,
hebraico e correspondência entre versículos das edições.

### 2. Projetar uma consulta compacta por lema

Proponha e implemente localmente, com fixtures declaradas, um índice invertido
versionado por idioma e identidade lexical da fonte. Ele deve apontar para
referências e ocorrências reais sem repetir textos bíblicos inteiros e sem
gravar no Supabase. Avalie arquivo estático particionado por intervalo/chave,
tamanho, hash, atribuição, tempo de geração e custo de leitura em celular;
medir dados em vez de estimar a partir de um único capítulo. Não criar um
arquivo público nem redistribuir fontes enquanto licença não for demonstrada.

### 3. Contrato de consulta e resultados honestos

Crie serviço puro/injetável para procurar usos por identidade validada, com
paginação/limites, ordenação canônica, indicação de cobertura, fonte e versão,
sem expor arquivos privados. Diferencie uso de um lema, sentido contextual,
tradução e alinhamento editorial. Repita a referência apenas quando necessário;
agrupe ocorrências do mesmo versículo sem perder posições da fonte. Versículos
com numeração divergente exigem mapa versionado explícito. Estados sem índice,
parcial, erro e vazio devem ser diferentes.

### 4. Prova local e testes adversariais

Use fixtures pequenas para vários livros e capítulos e, quando licenciado e
disponível localmente, faça uma medição reproduzível do corpus real sem subir
dados. Teste repetição no mesmo versículo, homógrafos, morfemas, sufixos Strong,
ordem canônica (inclusive 1:2 antes de 1:10), paginação, ausência de fonte,
versificação divergente e falhas de integridade. Reprocessar os mesmos bytes
deve produzir os mesmos hashes. Compare alguns resultados de Gênesis e João
com a fonte diretamente, sem inventar traduções.

### 5. Preparar integração futura

Descreva uma API e tela simples para: significado e atribuição, ocorrências,
trecho em português, contexto e filtros. Aponte o que já existe no painel e o
que ainda não está revisado; não implemente gráficos de distribuição que deem
impressão de cobertura completa sobre amostra parcial. Documente como o futuro
pacote offline do Claude 1 poderia consumir o índice depois de estabilizado,
sem assumir o formato nem tocar nos arquivos dele.

### 6. Relatório

Entregue fontes, licenças, hashes, tamanhos real e comprimido, arquivos,
resultados de teste, limitações e próximos passos para revisão. Execute lint,
typecheck e testes focados; suíte completa se possível. Não marcar integração
ou publicação como concluída enquanto não existirem.

## Escopo e limites

Escrever apenas em `src/domain/word-study/**`, `src/server/word-study/**`,
`scripts/*word-study*`, `tests/domain/word-study*`, `tests/server/word-study*`,
`tests/scripts/*word-study*` e relatórios `tasks/product/word-study-*`. Usar
arquivos temporários gerados fora de `public/` e ignorados pelo Git. Preservar
mudanças e processos alheios. Sem rede externa, sem alterar `.env*`, sem banco
ou migrations remotas, sem importar para Supabase, sem commit, push ou deploy.
Banco local descartável é permitido quando necessário. Entrega para revisão do
agente principal; não publicar dados ou enviar mensagens externas.
