# Piloto de pronúncia e tradução — 25/11/2026

Pedido do proprietário: experimentar a página de estudo da palavra do print,
com transliteração, pronúncia, acepções em português e créditos recolhidos.

Implementado localmente para `hbo:H7121`, verbete BDB `s.cy.aa`: transliteração
`qârâʼ` e indicação aproximada `ca-RÁ` a partir de `HebrewStrong.xml` (entrada
H7121, campos `xlit` e `pron`); botão de áudio somente quando o navegador
oferece voz hebraica, usando a API de fala do navegador. Áudio e pronúncia são
aproximados, não gravação certificada de hebraico bíblico.

As definições conhecidas desse verbete têm tradução de trabalho em português,
identificada como experimental e não revisada, com o inglês ao lado. Definições
não reconhecidas continuam em inglês; outros verbetes não herdam esta tradução.
O texto completo de atribuição continua acessível em “Sobre a fonte”.

Arquivos: `app/palavra/page.tsx`, `palavra.module.css`, `piloto.ts`,
`pronunciation.tsx`, `tests/domain/word-study-pilot.test.ts`. Não há alteração
no banco nem nova dependência. As acepções traduzidas precisam de revisão
editorial, e o áudio e o layout móvel precisam ser experimentados em aparelho
real antes de ampliar para outros verbetes.

## Deploy de validação solicitado pelo proprietário

Publicado isoladamente em 25/11/2026, versão Cloudflare
`551704b7-a9f7-4c36-8599-c47f4dd3d938`. Base: Git `fd226aa` mais os quatro
arquivos de `app/palavra` deste piloto; não incluiu as mudanças locais de offline
ou contexto. Build OpenNext concluído; os dois testes do piloto, typecheck e
lint dos arquivos passaram. HTTP 200 na página pública H7121, com transliteração,
pronúncia, aviso de tradução e créditos encontrados no HTML; Gênesis 1 também
respondeu HTTP 200. Áudio, aparência móvel e qualidade editorial não foram
validados em aparelho real. Nenhuma alteração no banco remoto. **O piloto ainda
não foi commitado:** incluí-lo ao integrar o código, para não perdê-lo no próximo
deploy. A primeira tentativa de build isolado falhou por junction no Windows;
a segunda, com dependências copiadas, concluiu normalmente.

## Ajuste visual após avaliação do proprietário

Em 25/11, removida a numeração automática duplicada das listas, com níveis de
sentido identificados uma única vez e grupos destacados. O português permanece
visível e a lista em inglês fica em `Ver definições em inglês`, sem perder a
hierarquia. Alguns trechos sem tradução seguem em inglês, identificados no aviso.
Build, lint e typecheck passaram; publicado isoladamente no Cloudflare como
versão `0bbb27ec-f1ad-48ca-a6d8-912787fe8f72`. A página H7121 respondeu HTTP 200
com a nova seção. Ainda sem commit; preservar todos os arquivos do piloto na
integração futura. A experiência visual em aparelho real aguarda o proprietário.

## Painel do leitor — versão publicada para Gênesis 1:5

Solicitação posterior: transliteração identificada no cartão de palavra,
manter glossa inglesa e acrescentar palavra em português da Bíblia Livre,
acepções em português no painel e créditos no estudo detalhado. Para o teste,
`app/palavra/piloto.ts` limita explicitamente `chamou` às posições 1 e 6 de
Gênesis 1:5, H7121 e tradução Bíblia Livre; não presume alinhamento em outras
versões ou versículos. `app/biblia/original-panel.tsx` mostra acepções com
tradução experimental H7121, esconde outras ainda não traduzidas e direciona
ao estudo detalhado; glossa original inglesa permanece. O detalhe consulta as
fontes lexicais e mostra seus créditos em “Sobre as fontes”.

Publicado isoladamente em `d76cf11e-3b4d-407e-9770-7e40cbeb8166`, base
`fd226aa` mais arquivos do piloto e `app/biblia/original-panel.tsx`, sem demais
frentes. Testes focados 16/16, lint, typecheck e build passaram; HTTP 200 em
Gênesis 1 e no detalhe H7121, onde os créditos MACULA e BDB foram conferidos no
HTML. A interação de toque no celular ainda precisa da validação do proprietário.
Alterações locais não commitadas: preservar todos esses arquivos no próximo
commit/deploy para não regredir a publicação.

## Simplificação do cartão e H2822

Publicado em 25/11/2026 na versão Cloudflare `a34fe8ab-dfe8-484d-adef-795529ba8c41`,
em build isolado. O cartão lexical omite morfemas funcionais quando há lema com
Strong e mostra o lema principal; H2822 tem sentidos de trabalho em português e
`trevas` no contexto específico de Gênesis 1:5, Bíblia Livre. O original continua
disponível no detalhe; as traduções estão marcadas como não revisadas. 17 testes
focados, lint, typecheck e build passaram. A página pública H2822 respondeu 200
com `trevas`, `aflição` e aviso da tradução experimental; interação móvel ainda
precisa de validação. Nada foi gravado no Supabase. Alterações ainda não commitadas.

## Ocorrências: forma textual e trecho em português — 25/11

Publicado no Worker `e04fb5aa-0fe5-413a-887e-c0c121c601a7`, com build isolado.
A página busca em uma consulta as posições exibidas de Gênesis 1 na edição
MorphHB aprovada, confere a parte lexical contra a forma e verifica a edição e
variantes antes de exibir a transliteração automática, calculada no navegador.
Trechos da Bíblia Livre aparecem apenas para ligações editoriais existentes e
H6440 em Gn 1:2, 20 e 29. Em 1:20 apresenta a expressão mais ampla da tradução.
Sem correspondência conferida, não atribui uma palavra portuguesa. Em outros
capítulos e edições, a transliteração nesta tela fica explicitamente indisponível.
Não amplia o corpus armazenado, não escreve no Supabase nem faz consulta por
palavra; acrescenta uma consulta por página para as posições elegíveis.

Testes focados (22), lint, typecheck e build passaram. Chromium em 390 px no
site público: H6440 mostra `pene`, `face` em 1:2 e 1:29 e `na expansão aberta
dos céus` em 1:20; H7121 mostra formas textuais distintas e `chamou` em 1:5.
Não houve teste em iPhone físico. A cobertura de todas as traduções, palavras e
capítulos continua pendente; não declarar o projeto lexical completo. Alterações
locais seguem sem commit.

## Acepções de Gênesis — lotes experimentais

Os lotes `gen1-lote-001` e `gen1-lote-002` fornecem 72 acepções de trabalho
em dez verbetes. A página as apresenta como tradução experimental não revisada,
com inglês consultável. A associação exige Strong, identificador exato do BDB,
caminho da acepção e correspondência do texto original; se qualquer dado mudar,
a tradução não é aplicada. Não houve nova tabela nem consulta ao Supabase. A
normalização da chave Strong também preserva sufixos de homógrafos, e a página
avisa quando um código reúne mais de um verbete. A distinção completa dos
homógrafos na importação ainda requer revisão e reprocessamento adequado.

Publicado em 26/11/2026 no Worker `ff830dfc-4eec-4143-a55b-14adb6c33706`.
Build OpenNext, ESLint direcionado e testes focados passaram. Chromium no site
público confirmou H1254, H216 e H7121, aviso de rascunho, inglês acessível e
aviso de homógrafos; ausência de rolagem horizontal em 390 px para H1254.
Algumas definições de cabeçalho ainda permanecem em inglês. A publicação não
inclui o offline ou o índice completo, ainda pendentes de correções e revisão.
