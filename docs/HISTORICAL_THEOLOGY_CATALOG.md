# Catálogo inicial — teologia histórica de acesso aberto

**Status:** pesquisa de proveniência; nenhum item deste arquivo foi baixado, importado ou liberado no produto.  
**Regra:** a aprovação é por arquivo/edição, não pelo nome do autor ou antiguidade da obra. Texto original antigo, tradução, transcrição, introdução, markup e OCR podem ter titulares distintos.

## Critério de entrada

1. Guardar URL, data de coleta, arquivo original, SHA-256, edição, idioma e cabeçalho de direitos.
2. Só importar quando a edição específica autorizar armazenamento, processamento, reprodução e o território pretendido.
3. Não reutilizar PDF/HTML/markup da CCEL comercialmente só porque a obra histórica é antiga: a CCEL reserva direitos sobre o site e conteúdos especiais e pede contato para republicação comercial. A ficha de cada obra prevalece sobre o catálogo. [Política CCEL](https://www.ccel.org/about/copyright.html)
4. Material do Project Gutenberg é uma pista de aquisição, não uma aprovação mundial automática: a instituição declara principalmente domínio público sob a lei dos EUA e impõe termos sobre os eBooks. [Termos do Project Gutenberg](https://www.gutenberg.org/policy/license)

## Candidatos priorizados

| Ordem | Autor e obra | Idioma/edição identificada | Fonte e formato | Situação de direitos para o MVP | Risco e próximo gate |
| --- | --- | --- | --- | --- | --- |
| 1 | Agostinho, *Confissões* | Inglês, Edward B. Pusey | [CCEL HTML/ficha](https://www.ccel.org/a/augustine/confess/cache/confess.html3) | A ficha declara **Public Domain** | Confirmar arquivo bruto e retirar introduções/markup CCEL antes de qualquer distribuição comercial. |
| 2 | Agostinho, *Confissões e Cartas* (NPNF1-01) | Inglês, edição Schaff, 1886 | [CCEL NPNF1-01](https://ccel.org/s/schaff/npnf101/cache/npnf101.html3) | A ficha declara **Public Domain** | Bom primeiro corpus, mas preservar a edição e excluir páginas/editoriais não aprovadas. |
| 3 | João Calvino, *Institutes of the Christian Religion* | Inglês, Henry Beveridge | [CCEL ficha](https://www.ccel.org/c/calvin/institutes/index.html) | A ficha declara **Public Domain** | Preferir texto puro da edição Beveridge; não importar PDF CCEL, cuja formatação possui regras próprias. |
| 4 | João Calvino, *Institutio Christianae Religionis* | Latim, 1559 | [guia de edições CCEL](https://www.ccel.org/institutes) | Autor/edição histórica são candidatos a domínio público | Localizar fonte digital com licença explícita para a transcrição; não inferir direitos da página-guia. |
| 5 | Martinho Lutero, *De Servo Arbitrio* / *Bondage of the Will* | Inglês, Henry Cole, 1823 | [CCEL PDF](https://www.ccel.org/ccel/l/luther/bondage/cache/bondage.pdf) | Candidato histórico, **ainda não aprovado** | O PDF/markup da CCEL requer análise separada; obter texto sem as camadas editoriais ou permissão. |
| 6 | Tomás de Aquino, *Summa Theologica* | Inglês, Benziger/English Dominican Province, 1947 | [CCEL ficha e formatos](https://www.ccel.org/ccel/aquinas/summa.html) | **Bloqueado até licença da edição** | A obra medieval não libera automaticamente esta tradução/arquivo do século XX; não importar. |
| 7 | Atanásio, *On the Incarnation* (NPNF) | Inglês, coleção NPNF | CCEL/NPNF, pesquisar ficha de volume antes de coleta | Candidato de domínio público | Aprovar apenas se a ficha concreta trouxer `Rights: Public Domain`; não usar por associação de coleção. |
| 8 | João Crisóstomo, homilias (NPNF) | Inglês, coleção NPNF | CCEL/NPNF, pesquisar ficha de volume antes de coleta | Candidato de domínio público | Mesmo gate: edição/tradução e arquivo concreto precisam de prova. |
| 9 | Jonathan Edwards, obras históricas | Inglês, edições pré-1923 | Project Gutenberg/escaneamentos públicos | **US-only / pendente para Brasil** | Project Gutenberg não é autorização mundial nem para marca/arquivo; procurar edição globalmente PD ou licença aberta. |
| 10 | John Bunyan, *The Pilgrim's Progress* | Inglês, edições históricas | Project Gutenberg/escaneamentos públicos | **US-only / pendente para Brasil** | Mesmo risco territorial e de transcrição; não importar sem parecer por edição. |
| 11 | Gregório de Nazianzo, Basílio, Irineu e outros Padres | Grego/latim originais via Perseus/Open Greek and Latin | [Perseus canonical README](https://github.com/PerseusDL/canonical/blob/master/README.md) | Repositório informa CC BY-SA 3.0 US salvo indicação diversa | Share-alike, atribuição e versão precisam entrar no produto; confirmar obra, edição e compatibilidade comercial antes de distribuir. |
| 12 | Textos clássicos greco-latinos em TEI | Grego/latim, PerseusDL | [fonte e proveniência](https://philologia.co.uk/about) | Cadeia de fontes reporta CC BY-SA para dados Perseus | Útil para originais e análise, mas não substitui tradução portuguesa licenciada. |

## Primeira ordem de importação recomendada

1. **Agostinho, Confissões (Pusey)** — somente após salvar a ficha CCEL que marca a edição como domínio público e validar o arquivo sem conteúdo adicional.
2. **Calvino, Institutas (Beveridge)** — mesma disciplina de edição/arquivo; não usar a edição Battles de 1960 sem licença.
3. **NPNF, um volume por vez** — iniciar com um único volume e registrar estrutura/citações antes de escalar.
4. **Grego/latim PerseusDL** — importar só quando o pipeline aceitar obrigação CC BY-SA, proveniência por commit e atribuição na interface.

## Campos obrigatórios no BKF antes da importação

`autor`, `obra`, `edição`, `tradutor`, `idioma`, `fonte URL`, `licença`, `território`, `permissões de store/process/quote/distribution`, `atribuição`, `hash`, `data de coleta`, `versão de extração`, `responsável pela aprovação` e `limites de citação`.

Qualquer campo ausente mantém o item em `RIGHTS_BLOCKED`; disponibilidade gratuita não é evidência suficiente.
