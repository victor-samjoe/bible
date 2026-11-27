# Índice de palavras e alinhamento — continuidade de 27/11

## Entrega local, sem publicação

O pacote do Claude 3 foi integrado apenas como módulos e ferramentas locais;
nenhuma rota foi ligada ao leitor, não houve deploy, nem escrita no Supabase.
São preservadas as atribuições das fontes registradas no manifesto do índice.

- O serviço não declara cobertura exaustiva com base apenas em registros nos
  66 livros. Até haver prova por fonte, identidade e intervalo, consultas com
  resultados são parciais e ausências não são afirmações sobre toda a Bíblia.
- Cursor versão 2 contém a identidade, a versão do índice e a referência;
  reutilização noutra palavra ou versão é rejeitada. A versão do índice agora
  inclui formato, orçamento e hashes das partições além dos hashes das fontes.
- O leitor de manifesto valida campos aninhados, hash, forma dos nomes,
  ordenação, sobreposições e totais, recusando manifesto inválido.
- Falta completar a validação estrutural e semântica do conteúdo das postagens,
  avaliar limites operacionais e integrar o índice à interface com tratamento
  dos estados parciais. O parser de partição não foi auditado integralmente.

## Medição local do corpus real

`scripts/audit-word-study-corpus.ts` usa o adaptador MACULA existente em lotes
de 2.000 linhas, SQLite temporário e heap limitado a 128 MB. Não grava dados
no Supabase nem publica artefatos. SHA-256 dos arquivos lidos:

- Hebraico: `965cb0599beed2fe31283b615bcc369178141c0e718a66d97518d94309cfc124`.
- Grego: `7f71504fdee8659bdd9f85342e4103d645864c2851b8205915bb298f0c004cc5`.

| Fonte | Ocorrências aceitas | Identidades exatas | Livros com dado | Referências |
| --- | ---: | ---: | ---: | ---: |
| Hebraico | 469.476 | 9.371 | 39 | 23.213 |
| Grego | 137.741 | 5.441 | 27 | 7.939 |

Sem identificador duplicado detectado; cinco Strong hebraicos e sete gregos
inválidos foram recuperados pelo lema. No hebraico, 6.435 registros sem forma
escrita ficaram fora conforme política do adaptador. Não confundir esses números
com validação linguística da política de exclusão ou completude do texto.

Ao simular a serialização das postagens com orçamento de 10.000 ocorrências:
60 partições, sete acima do orçamento, 3.862.496 bytes crus, soma gzip nível 9
de 1.210.755 bytes, maior partição 39.774 bytes gzip. Não inclui manifesto,
headers, caches ou tráfego real. SHA-256 da concatenação das postagens:
`4953c28fbcd5e9fb29632689e9a3a67e9feca9e8469d83702c909b329938b123`.

No recorte de testes, a medição gerou o mesmo hash do gerador original:
`494873b88b43c55d14773da38181793a2f9ec8147bc094aac8264524c09e899e`
(738 bytes crus, 213 gzip). Ainda falta construir o **índice real publicável**
em fluxo, conferir seu determinismo e comparar todas as partições com uma
implementação independente. Esta medição não é esse índice.

Não existe agrupamento automático validado de Strong de formas flexionadas em
um lema (exemplo G2258/G1510), portanto contagens são por chave exata. Não há
garantia de completude apenas porque houve registros em todos os livros.

## Gênesis 2

`node --experimental-strip-types scripts/build-genesis2-review.ts` prepara
`data/generated/lexicons/batches/gen-2-caderno-revisao.md` com 25 versículos,
unidades, hipóteses, conflitos e lacunas. O gerador exige o lote local e o
shard correspondente; confere o hash declarado no shard e as referências de
unidades e tokens. A saída é provisória e está fora do Git.

Nenhuma hipótese foi aprovada: é necessária revisão contextual por pessoa
identificada, inclusive grupos 1:N/N:1 e lacunas. Em Gênesis 2:1, por exemplo,
há concorrência entre conjunções e palavras sem hipótese; isso não deve ser
resolvido apenas pela posição. A palavra original de posição 1 reúne dois
morfemas: a conjunção tem candidatos para diferentes posições de “e”, enquanto
o verbo correspondente à construção “foram concluídos” não recebeu uma ponte
de tradução. Exibir só a sugestão parcial daria uma análise incompleta.
Próximo passo: registrar decisões, evidências e
versões, testar importação para o formato editorial e validar independentemente
antes de exibir as ligações como revisadas.
