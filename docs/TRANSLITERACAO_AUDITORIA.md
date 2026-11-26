# Auditoria de transliteração — diagnóstico e implementação em avaliação

Em andamento, 25/11/2026. O diagnóstico inicial é preservado abaixo; as seções
seguintes registram medições e implementação local, ainda sem validação
linguística conclusiva.

## Causa confirmada no código

- O leitor original entrega as formas textuais MorphHB (hebraico) e SBLGNT
  (grego). O importador SBLGNT não calcula transliteração.
- `src/importers/lexicon/oshb-hebrew-lexicon.ts` lê `w@xlit` de verbetes
  HebrewStrong; `scripts/build-lexicon-chapter-shards.ts` obtém por `lexemeKey`
  o verbete e coloca essa transliteração na posição 5 do shard de ocorrência.
- `src/server/lexicon/repository.ts` lê esse valor como `entryTransliteration`;
  `src/domain/lexicon/word-analysis-view.ts` o entrega como transliteração do
  morfema. `app/biblia/original-panel.tsx` junta esses valores e os rotula como
  transliteração da palavra textual. Uma forma de lema é assim apresentada como
  forma flexionada, com risco de omitir prefixos ou sufixos.
- O painel também usa primeiro notas específicas de `src/domain/word-analysis.ts`
  para Gênesis 1:1, com outra convenção, causando divergência entre as duas linhas.
- O TSV local de MACULA Hebrew tem coluna `transliteration` **por morfema**; o
  importador atual não a preserva. É candidata para estudo, não prova automática
  de equivalência: exige alinhamento com MorphHB, cobertura, licença, convenção e
  revisão dos casos especiais. O MACULA Greek local não tem essa coluna.

## Referências primárias a analisar

- Open Scriptures: [descrição de prefixos, palavra e sufixos na fonte MorphHB](https://github.com/openscriptures/morphhb/blob/master/read/readme.md) e [versão OSHB 2.2 e ketiv](https://github.com/openscriptures/morphhb/releases).
- Biblioteca do Congresso: [tabelas ALA-LC](https://www.loc.gov/catdir/cpso/roman), [hebraico](https://www.loc.gov/catdir/cpso/romanization/hebrew.pdf) e [grego antigo](https://www.loc.gov/catdir/cpso/romanization/greeka.pdf). As convenções devem ser identificadas; não são automaticamente pronúncia bíblica.
- [MACULA Greek: descrição e licença](https://github.com/Clear-Bible/macula-greek/blob/main/LICENSE.md).

## Limites identificados antes das medições

Ainda não foram auditadas as ocorrências completas dos corpora, nem definidas
convenções simplificada e acadêmica para todas as situações. Uma regra mecânica
de caracteres não resolve por si só shevá, daguesh, formas não vocalizadas,
ketiv/qere ou divergência entre edições. Não aplicar migração ou escrever no
banco de produção. Registrar contagens e exceções antes de declarar correção.

## Primeira medição completa das fontes locais

Executado `python scripts/audit-transliteration.py`, em 25/11/2026, sem rede ou
banco. A comparação usa referência e posição mais superfície com normalização
Unicode: no hebraico remove separadores e cantilação, preservando vogais,
daguesh e shin/sin; no grego remove apenas pontuação das bordas e usa NFC.
Igualdade de superfície **não prova** equivalência de edição, correção fonética
ou revisão especializada. A auditoria espelha os `<w>` do parser atual; ketiv é
uma categoria sobreposta, não uma contagem a somar.

| Métrica | MorphHB hebraico | SBLGNT grego |
| --- | ---: | ---: |
| Ocorrências percorridas | 306.785 | 137.542 |
| Formas distintas após normalização | 53.905 | 22.538 |
| Forma coincide com MACULA por posição | 305.517 | 128.740 |
| Correspondência com transliteração por morfema completa | 256.037 | 0: a tabela grega não tem a coluna |
| Forma coincide, mas transliteração de morfema falta | 49.480 | não aplicável |
| Forma não coincide | 0 | 8.801 |
| Sem correspondência por posição | 1.268 | 1 |
| Ketiv marcado (sobreposto às categorias) | 1.258 | não aplicável |

Exemplo de falta real: em `GEN 1:11!13`, MACULA traz transliteração para a
preposição mas não para o substantivo e o sufixo. Os 1.268 sem posição incluem
as diferenças que exigem investigação de ketiv/qere e versificação. A contagem
de divergências é comparação de forma, não número de erros linguísticos. Ainda
não foi contabilizada a transliteração efetivamente disponível em produção nem
quantas divergências entre lema e superfície são semanticamente relevantes.
Também não houve correção publicada nesta etapa da auditoria.

## Implementação local em avaliação

O leitor deixou de usar o campo lexical do shard como se fosse forma textual.
`src/domain/transliteration/hebrew.ts` recebe somente a forma vocalizada da
ocorrência, retira separadores de morfema e utiliza `hebrew-transliteration`
2.11.0 / `havarotjs` 0.25.4 (MIT) na convenção acadêmica SBL documentada pela
[biblioteca](https://charlesloder.github.io/hebrew-transliteration/api/classes/sbl/).
A forma simplificada é derivação editorial explicitamente documentada no código:
remove diacríticos, representa `š` por `sh`, `ṣ` por `tz`, neutraliza geminação
e torna outras distinções mais acessíveis. **Não é fonética nem padrão acadêmico**;
precisa de revisão especializada. O tetragrama é exibido como `YHWH`, sem
reconstruir pronúncia. Sem vogais reconhecíveis ou com caracteres não tratados,
retorna indisponível. O resultado automático é sinalizado como sujeito a revisão.

O índice `data/generated/transliteration/morphhb-ketiv.json` contém somente
1.258 posições marcadas `x-ketiv` e 1.278 posições em leituras `x-qere` na OSHB v.2.2 (commit
`6a5db284c715c18b239422e57bb89684e6a19f00`). É gerado por
`scripts/build-transliteration-ketiv.ts`; o leitor interrompe a transliteração
nessas posições e também em edições hebraicas não reconhecidas. Em Gênesis 8:17,
o importador atual armazena a forma escrita e a alternativa como posições 14 e 15
consecutivas: a interface agora as sinaliza como variantes. A correção estrutural
da importação e das referências dependentes ainda não foi implementada; não se
deve reimportar dados de produção sem plano de migração e verificação. Isso **não**
encerra a auditoria qere: casos não marcados e a relação entre posição de fontes
distintas exigem investigação adicional.

Para grego, `src/domain/transliteration/greek.ts` opera sobre a forma SBLGNT e
implementa a tabela ALA-LC, incluindo espírito áspero, ditongos e gama nasal;
caracteres não reconhecidos retornam indisponível. A própria ALA-LC omite
acentos, espírito brando, diérese e iota subscrito: essa escolha não preserva
todas as distinções e o iota é sinalizado na interface. A implementação é
experimental e não é uma transcrição fonética. Testes comparam exemplos com a
[tabela primária ALA-LC](https://www.loc.gov/catdir/cpso/romanization/greeka.pdf);
para hebraico, há exemplos de [material didático publicado pela SBL](https://www.sbl-site.org/wp-content/uploads/2025/01/BiblicalHebrew_PutnamHB_SPP.pdf)
e do enunciado. Convenções independentes diferem no tratamento de algumas vogais.

A interface calcula um único resultado por token e o reutiliza na palavra e na
análise. Original e transliteração formam um par para manter o alinhamento em
quebras de linha; o valor da fonte lexical é rotulado separadamente como lema.
O processamento é local no navegador, sem chamadas de IA ou nova consulta ao
Supabase. Medição preliminar neste computador: 434 formas de Gn 1 em 830 ms sob
carga; o módulo hebraico isolado empacotado mede 49.689 B, ou 14.216 B gzip.
Esses números não são medição em celular nem em produção.

`scripts/audit-greek-transliteration.ts` percorreu as 137.542 ocorrências da
SBLGNT: 137.521 tiveram saída sintática e 21 ficaram sem saída (21 formas
distintas), inclusive palavras agrupadas com travessão, algarismos e pontuação. Saída
sintática **não prova** correção filológica; as exceções não são publicadas como
resultado confiável.

O conversor hebraico foi percorrido sobre 306.785 ocorrências MorphHB, com
111.768 formas distintas incluindo cantilação: 305.503 tiveram saída sintática e
1.282 foram recusadas. Medição com
`node --max-old-space-size=384 --experimental-strip-types scripts/audit-hebrew-transliteration.ts`.
As 1.258 formas explicitamente marcadas `x-ketiv` estão entre as recusadas (a
sobreposição foi medida por `scripts/audit-hebrew-ketiv.ts`); as 24 ocorrências
restantes requerem triagem própria. Das 305.503 formas com saída sintática, as
1.278 referências qere também são suspensas na interface; a sobreposição foi
medida pelo mesmo script. Assim, na edição auditada, 304.225 ocorrências teriam
saída exibível e 2.560 ficariam sem saída (1.258 ketiv, 1.278 qere e 24 outras).
A saída gerada continua sujeita à revisão;
não se afirma que 305.503 resultados foram corrigidos filologicamente. A
verificação contra o inglês do MACULA é indicador de cobertura e correspondência,
não um exame independente da pronúncia ou da convenção SBL.

As 24 ocorrências recusadas fora de `x-ketiv`, em referência OSIS e posição
do importador, são: 2Chr 34:6!7; 2Sam 19:20!17; 2Sam 21:12!24; Deut 29:28!5,
!6; Ezek 41:20!9; Ezek 42:9!1; Ezek 46:22!13; Gen 18:9!2; Gen 19:33!15;
Gen 33:4!8; Gen 37:12!4; Isa 44:9!9; Isa 44:24!16; Jer 48:44!1; Job 38:1!5;
Job 38:12!4; Job 40:6!5; Judg 16:25!2; Lam 4:3!11; Num 3:39!7;
Num 21:30!9; Num 29:15!1; Ps 27:13!1. Algumas trazem sinais editoriais U+05C4;
outras são formas sem vocalização. Não foram normalizadas silenciosamente.
As 21 exceções gregas, com referência e posição, estão em
`docs/TRANSLITERACAO_GREGO_EXCECOES.json`.

Os sete exemplos reais de Gn 1:1 foram conferidos usando a resposta pública da
API de originais: as formas simplificadas são `bereshit`, `bara`, `elohim`, `et`,
`hashamayim`, `ve'et` e `ha'aretz`; o primeiro acadêmico é `bərēʾšît`. O teste
de componente em navegador `node scripts/verify-transliteration-browser.mjs`
passou em Chromium nas larguras 320, 390 e 1024 px, com APIs simuladas: verificou
ordem RTL, quebras de linha, seleção, concordância entre linha e painel,
`λόγον → logon` e sinalização dos dois lados de ketiv/qere. Não é teste de iOS
nem validação de especialista.

Foi criado um Postgres 16 descartável, restrito a `127.0.0.1:55439`, banco
`translit_audit`, e usado por `tests/server/transliteration-postgres.test.ts`:
**2 testes passaram** pelo repositório Drizzle real, leitor original e conversor
para verificar prefixo/morfemas hebraicos e duas flexões gregas. As tabelas são
temporárias; o teste recusa endereços que não sejam o banco local dedicado. O
container foi removido após o teste. São fixtures locais, não cópia nem consulta
do banco de produção. A UI foi testada separadamente com APIs simuladas; uma
validação de ponta a ponta da UI com este banco continua pendente.

Riscos abertos: a simplificação para português é uma convenção editorial ainda
sem aprovação por especialista; Hebrew e Greek têm exceções identificadas; a
morfologia e o texto dos dois corpora não são prova de equivalência entre
edições; resultados automáticos precisam de amostragem independente em outros
livros e flexões, além dos exemplos cobertos. Sete testes de integração de um
shard lexical separado continuam ignorados por exigirem outro banco preparado.
Esta avaliação não autoriza tratar os resultados como versão definitiva sem
concluir a validação; a publicação posterior para teste está registrada abaixo.
Não executar migration sem autorização específica.

## Medição do mecanismo anterior nos shards locais

`node --experimental-strip-types scripts/audit-lexical-shard-transliteration.ts`
leu o artefato local completo, não o banco remoto. Em 929 capítulos hebraicos,
há 305.517 posições MACULA; 293.199 possuem ao menos um valor de transliteração
lexical. Em 133.147 posições havia algum valor e algum morfema com superfície
mas sem valor; em 131.246 havia múltiplos morfemas e só uma transliteração.
Essas são situações em que a concatenação anterior é incompleta **como dados**,
não uma contagem de erros linguísticos: o próprio shard já omitiu algumas linhas
e valores lexicais não seguem a mesma convenção que a textual. Para o grego,
137.734 de 137.741 posições em 260 capítulos tinham valor lexical; isso não
garante que representavam a flexão. A presença do corpus de shards local não
significa que esses capítulos estejam instalados em produção.

## Comparação com a transliteração por morfema do MACULA

`node --max-old-space-size=384 --experimental-strip-types scripts/compare-hebrew-macula.ts`
comparou as linhas MACULA locais agrupadas por referência, sem modificar dados:
305.517 posições, das quais 256.037 tinham transliteração da fonte completa e
256.028 também admitiram cálculo automático. Dessas, 71.191 coincidiram
exatamente e 165.249 após a normalização usada pelo script; 90.779 ainda
diferiram após essa normalização. O agrupamento não confirma, por si só, o
alinhamento com MorphHB. As convenções também divergem, por exemplo
`bərēʾšiyṯ` na fonte e `bərēʾšît` no cálculo; diferenças incluem ainda
pontuação, vogais e consoantes. Portanto, esses números não contam erros
linguísticos corrigidos ou confirmados e não substituem revisão especializada.

Uma compilação OpenNext de um snapshot isolado aumentou o tamanho informado da
rota de leitura de 16,6 para 42,5 kB, e do JavaScript inicial de 123 para
149 kB. A medida inclui a implementação e a biblioteca; não é medição real
de download, desempenho móvel, egress ou consumo Supabase. O snapshot antecede
pequenos ajustes posteriores e não constitui build do estado final.

## Publicação para validação do usuário

Em 25/11/2026, após autorização expressa, build isolado foi publicado no Worker
`samjoe-estudos`, versão `cc053310-0295-4a20-80ff-ec5c0ab91428`, preservando
o piloto H2822 já em produção. O build passou e carregou quatro assets novos;
não executou migration, processamento do corpus remoto nem gravação no Supabase.
Em Chromium de 390 px no site público, selecionamos Gênesis 1:1, abrimos
Consultar original e selecionamos a primeira palavra: a linha mostra `bereshit`
e o painel mostra `bereshit` e `bərēʾšît`. Não substitui a avaliação do usuário
no próprio dispositivo nem a revisão linguística pendente registrada acima.
As alterações locais continuam sem commit.

Em 25/11/2026, a versão `5fca8aab-928f-4630-9c35-b6dd4e9d235d` foi
publicada com correção de contraste da transliteração selecionada no tema
escuro e menu de cores recolhível. Em Chromium de 390 px no site público,
confirmamos o menu fechado sem rolagem, abertura das cores e texto selecionado
em `rgb(20, 36, 47)`. O teste local também cobriu larguras de 320 e 390 px.

Na revisão final deste estágio, `npm run typecheck` e o ESLint direcionado
passaram; os 29 testes direcionados de transliteração passaram. A suíte geral
anterior passou 764 testes com 7 ignorados, antes dos últimos ajustes; não se
deve interpretar essa execução anterior como teste integral do estado final.
