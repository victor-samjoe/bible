# Gênesis 1 — contexto e interpretações, sem ampliar o banco

O proprietário pediu uma experiência simples que permita comparar leituras de
outros autores e compreender o contexto. Trabalhar em sequência dentro de cada
frente, localmente. Se faltarem dados, direitos ou decisão editorial, registrar
a lacuna e avançar apenas nos itens independentes. Não inventar citações,
autores, consenso, tradução ou contexto.

## Claude 1 — autores e história de interpretação

1. Inventariar o material local já disponível que trate efetivamente de Gênesis
   1:1–5. Para cada candidato registrar obra, autor, edição, idioma, fonte,
   localização verificável, hash e situação documental dos direitos. Verificar
   o conteúdo real, inclusive quando um arquivo for página de erro; não presumir
   que nome de arquivo prove obra, licença ou pertinência.
2. Montar uma proposta pequena de cartões comparáveis com evidência localizável,
   tradição, tese, trechos permitidos e contrapontos. Usar apenas conteúdo cuja
   edição e direitos possam ser demonstrados; o restante deve aparecer como
   pendente. Produzir resumo editorial em português somente quando sustentado
   pela fonte e claramente separado de citação e texto bíblico.
3. Preparar um protótipo ou contratos locais com fixtures identificadas se não
   houver dados aprovados. Projetar atualização e consulta sem adicionar conteúdo
   ao Supabase: avaliar pacote local versionado ou arquivo estático com checksum,
   licença e tamanho medido. Não decidir nem efetuar publicação.
4. Registrar o que pode ser revisto pelo proprietário e o que não pode ser
   publicado, com fonte e localização. Entregar testes e lista de arquivos.

Escopo de escrita: novos arquivos `src/domain/reception/**`, testes próprios e
`tasks/product/genesis-autores-*`. Não alterar arquivos da frente do Claude 2.

## Claude 2 — contexto de Gênesis e prova vertical

1. Inventariar o que já existe e está aprovado para Gn 1:1–5: BLIVRE, MorphHB,
   léxico e os dados BDB já importados no recorte de Gênesis 1. Distinguir fonte
   original, tradução aprovada, rascunho automático e alinhamento revisado.
2. Propor um guia visual progressivo: passagem em português, original, contexto
   textual e histórico com fontes, interpretações de autores e ligações para
   estudo de palavra. Não apresentar hipótese como consenso ou a ausência de
   evidência como prova. Não aproveitar rascunhos como texto revisado.
3. Criar contratos/testes locais de cartões de contexto para a prova vertical,
   com proveniência e localização obrigatórias, estados de revisão e dados de
   exemplo claramente rotulados. Os resultados publicados devem respeitar o
   grafo existente; não assumir que ele já tenha acervo real.
4. Preparar estimativas de armazenamento e plano de entrega com **zero escrita
   adicional no banco**: aproveitar dados existentes e, se necessário, pequeno
   pacote versionado fora do banco; medir bytes. Não baixar, importar ou publicar
   novas obras. Registrar dependências e incertezas.

Escopo de escrita: novos arquivos `src/domain/genesis-context/**`, testes
próprios e `tasks/product/genesis-contexto-*`. Não alterar arquivos da frente
do Claude 1 nem o painel de palavra que está sendo trabalhado pelo principal.

## Limites comuns

Sem rede externa, sem modificar `.env*`, sem escrita no Supabase ou em outros
serviços, sem migrations remotas, sem commit, push ou deploy. Não importar o
índice completo. Não publicar fontes sem comprovação de direitos e revisão.
Banco local descartável é permitido quando necessário. Trabalhar com arquivos
distintos e preservar alterações e processos alheios. Entregar resultado,
testes, pendências, estimativa de tamanho e comandos de reprodução ao agente
principal, que revisará antes de qualquer publicação.
