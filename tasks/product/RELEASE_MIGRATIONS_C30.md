# C30 — pendência para publicação

## Atualização posterior: recorte de Gênesis 1

Em 24/11/2026, por ordem do proprietário, a `0010` foi aplicada diretamente no
banco e um recorte de Gênesis 1 foi importado. Conferência após a importação:
690 ocorrências, nenhuma fora de `GEN 1:`, 93 verbetes lexicais, 110 verbetes
BDB, 112 ligações e 184 traduções. As traduções mantêm seus estados de revisão;
rascunhos de máquina não são aprovados automaticamente. O tamanho dos bancos do
cluster passou de 295.260.021 para 295.964.533 bytes. O journal ainda termina
na `0007`; a aplicação direta da `0010` não o atualizou.

O recorte foi gerado por `scripts/build-lexicon-genesis1-slice.mjs` e testado
duas vezes em Postgres descartável antes da importação remota. A opção `--scope`
do importador, isoladamente, não limita os verbetes e ligações BDB; por isso a
execução agora exige arquivos de entrada já recortados explicitamente.

A interface existente continua lendo os shards da `0009`: os dados novos de
BDB ainda precisam ser ligados ao servidor e ao painel antes de ficarem visíveis.

O journal Drizzle termina em `0007`. Os arquivos `0008`, `0009` e `0010`
existem localmente, mas não estão registrados nele. Não executar `db:migrate`
esperando que aplique esses três arquivos: no estado atual ele não os inclui.

Auditoria somente leitura em 24/11/2026, usando a conexão local configurada:
o journal remoto contém oito registros e termina na `0007`; `lexeme_entries` e
`lexeme_occurrences` existem, ambas com zero linhas; `lexicon_chapter_shards`
existe com 1.189 linhas; `lexeme_bdb_entries` e `lexeme_bdb_links` não existem.
Não se verificou equivalência completa de todas as constraints e índices, nem
se fez escrita no banco. A interface atual lê os shards; a `0010` e a importação
do BDB não estão concluídas nesse destino.

Medição adicional em 24/11/2026, também somente leitura: o total de todos os
bancos no cluster era 295.260.021 bytes; `postgres`, 279.983.795 bytes; WAL,
150.995.311 bytes. A tabela de shards ocupava 26.148.864 bytes com índices e
TOAST. A documentação desta frente estima ~290 MB para o índice relacional
completo: somá-lo ao uso atual ultrapassaria a quota gratuita nominal de 500 MB,
sem considerar crescimento ou outras bases da organização. Não importar o
índice relacional inteiro enquanto essa capacidade não for resolvida. O uso
total do disco e a média mensal da organização não foram medidos nesta consulta.

A `0009` cria os shards usados pelo leitor. A `0008` cria o índice relacional
de curadoria; a `0010` altera uma tabela criada pela `0008`, portanto **não**
pode ser aplicada isoladamente sobre um banco que tenha somente a `0009`.
Além das tabelas, a funcionalidade depende dos dados importados correspondentes.

Antes de qualquer alteração no banco de destino, conferir em leitura o estado
real das tabelas, dados e journal, e definir como registrar as migrations sem
reaplicar operações já executadas. Avaliar capacidade antes de importar o índice
relacional; os registros da C30 relatam que ele é volumoso. Aplicação remota e
importação continuam exigindo ordem operacional explícita. O build do app não
comprova que essas estruturas ou dados existam no banco de destino.
