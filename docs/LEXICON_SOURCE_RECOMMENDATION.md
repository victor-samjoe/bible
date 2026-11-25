# Fontes lexicais recomendadas

Pesquisa realizada em 19/11/2026, a partir das páginas, repositórios e licenças mantidos pelos
próprios projetos. Objetivo: análise por palavra no leitor, com uso comercial possível, procedência
registrada e sem depender de cadastro manual por versículo.

## Decisão recomendada

Não usar um único arquivo para tudo. Separar dois ativos:

1. **MACULA Hebrew e MACULA Greek**, da Clear Bible, para a ocorrência no contexto: forma, lema,
   morfologia, sentido, domínio semântico, estrutura sintática, papéis semânticos, referentes e
   sinônimos. Os repositórios declaram CC BY 4.0 e permitem adaptação e uso comercial com atribuição.
2. **Open Scriptures HebrewLexicon** para o verbete hebraico e **STEPBible TBESG + TFLSJ** para o
   verbete grego. Todos declaram CC BY 4.0; BDB, Strong, Abbott-Smith e LSJ subjacentes são obras
   históricas em domínio público, enquanto a edição digital exige a atribuição indicada.

Essa composição distingue corretamente **o que a palavra pode significar** (verbete) de **qual
sentido ela assume nesta ocorrência** (anotação contextual).

## Fontes aprováveis para prova técnica

| Camada | Fonte | Conteúdo útil | Licença declarada | Decisão |
| --- | --- | --- | --- | --- |
| Contexto hebraico | MACULA Hebrew | morfologia, sintaxe, sentidos, domínios, frames, referentes, sinônimos, equivalentes LXX | CC BY 4.0 | recomendar |
| Contexto grego NT | MACULA Greek | SBLGNT/N1904, morfologia, sentidos, domínios, frames, referentes, sinônimos | CC BY 4.0 | recomendar |
| Verbete hebraico | Open Scriptures HebrewLexicon | BDB, Strong e índice compatível com os lemas aumentados do MorphHB | CC BY 4.0; textos BDB/Strong declarados domínio público | recomendar |
| Verbete grego breve | STEPBible TBESG | lema, transliteração, classe, glossa e definição Abbott-Smith/Middle Liddell | CC BY 4.0 | recomendar |
| Verbete grego aprofundado | STEPBible TFLSJ | LSJ completo formatado e ligado ao Extended Strong | CC BY 4.0 | segunda camada |
| Alinhamentos | Clear Bible Alignments | formato e alinhamentos automáticos/revisados disponíveis | dados CC BY 4.0; código MIT | usar como base técnica, não presumir alinhamento BLIVRE |

## Restrição encontrada no TBESH

O cabeçalho atual do TBESH diz que a coluna **Gloss** foi criada por estudiosos da Tyndale, mas que
a coluna longa **Meaning** deriva do Abridged BDB do Online Bible e que deve ser obtida permissão antes
de aplicá-la em outro projeto. Portanto:

- não importar `Meaning` do TBESH;
- se TBESH for usado, limitar a importação aos campos claramente liberados e registrar a seleção;
- preferir `BrownDriverBriggs.xml`, `HebrewStrong.xml` e `LexicalIndex.xml` do Open Scriptures para
  definições hebraicas, cuja página declara CC BY 4.0 e o texto histórico em domínio público.

## Português

As fontes recomendadas estão majoritariamente em inglês. A versão portuguesa será um ativo derivado
separado, nunca sobrescrevendo o original:

- guardar texto-fonte, idioma, URL, commit/hash e licença;
- gerar tradução inicial em lote;
- marcar cada campo como `machine_draft`, `human_reviewed` ou `approved`;
- publicar como dado lexical apenas após revisão; antes disso, exibir a glossa curta original ou
  informar que a tradução editorial está pendente;
- atribuir a fonte mesmo depois da tradução e registrar nossas modificações.

## Fontes não escolhidas como núcleo

- **unfoldingWord UHAL/UGL**: material útil, mas CC BY-SA 4.0; o compartilhamento pela mesma licença
  amplia as obrigações sobre derivados. Pode ser referência suplementar depois de análise jurídica.
- **HALOT, BDAG e Louw-Nida comercial**: não importar sem licença contratual específica.
- resultados gerados por IA: podem ajudar a traduzir ou sugerir classificação, mas não substituem
  léxico, sentido anotado nem revisão editorial.

## URLs primárias

- https://github.com/Clear-Bible/macula-hebrew
- https://github.com/Clear-Bible/macula-hebrew/blob/main/LICENSE.md
- https://github.com/Clear-Bible/macula-greek
- https://github.com/Clear-Bible/macula-greek/blob/main/LICENSE.md
- https://github.com/Clear-Bible/Alignments
- https://github.com/openscriptures/HebrewLexicon
- https://github.com/STEPBible/STEPBible-Data
- https://github.com/STEPBible/STEPBible-Data/tree/master/Lexicons

## Próximo gate

Fixar tags/commits, baixar manifestos e hashes em diretório ignorado, auditar os campos efetivamente
utilizados e executar uma prova offline com Gênesis 1 e João 1. Nenhuma importação remota ocorre sem
aprovação explícita e sem gravar atribuição/licença junto a cada fonte.

### Andamento — 19/11/2026

A **fase de preparação** foi implementada: registro versionado das fontes com licença, atribuição,
campos selecionados e campos proibidos; coletor que grava só em diretório ignorado e falha fechada
em hash divergente; parsers determinísticos com proveniência por campo; contrato do fluxo editorial
de tradução; e fixtures offline de Gênesis 1:1 (hebraico) e João 1:1 (grego).

**Nenhuma fonte foi coletada**, nenhum commit foi fixado, nenhum SHA-256 real existe e nada foi
importado. Os pinos estão `unresolved` de propósito, e o coletor recusa baixar nesse estado.

Ver `docs/LEXICON_PIPELINE.md` (desenho e portões) e
`tasks/product/LEXICON-INDEX-001-preparacao.md` (estado item a item).
