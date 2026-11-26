# Revisão de publicação — 26/11/2026

## Já publicado anteriormente

As melhorias de estudo de palavras e os 72 sentidos em português de dez
verbetes de Gênesis 1 estão no site como tradução experimental não revisada.
O inglês permanece consultável. A transliteração é automática e a cobertura de
alinhamento e ocorrências ainda é parcial.

## Leitura offline e voz — lote de integração

O pacote BLIVRE optativo é composto de um manifesto e 66 arquivos estáticos:
4.147.636 bytes dos livros mais 24.878 bytes do manifesto; 1.360.671 bytes ao
somar gzip nível 9 dos livros nesta máquina, não promessa de tráfego do CDN.
Seu download envolve até 66 requisições de arquivos, apenas após consentimento;
verificações posteriores leem o manifesto e reaproveitam capítulos não alterados.
O texto vai para IndexedDB do dispositivo e não adiciona linhas, blobs ou
consultas ao Supabase. O repositório contém os arquivos estáticos necessários
para construir a versão; regenerá-los a partir da fonte exige o corpus local e
o ZIP de proveniência, que não estão incluídos neste commit.

Os 66 arquivos foram conferidos por SHA-256 contra o manifesto e todos os
31.102 versículos coincidiram com `data/generated/blivre.json` local. A
comparação com o site publicado foi amostral, não uma verificação integral do
banco de produção. A atribuição consta do manifesto e da leitura offline.

Corrigidos: poda que apagava marcas de instalação demorada; limpeza posterior
que poderia interferir em instalação concorrente; remoção de download parcial;
notas USFM aparecendo no texto offline; service worker que apagava caches de
outros recursos ou interceptava origens externas. Para não apagar staging em
uso, marcas antigas são preservadas até remoção explícita: podem ocupar espaço
enquanto o download estiver incompleto. A interface oferece a remoção mesmo sem
instalação concluída.

Validação local: testes focados de offline, voz e autenticação; testes reais em
Chromium e IndexedDB com duas conexões e duas abas para poda e reativação;
fluxo de consentimento,
download dos 66 livros, João 1 e Gênesis 1 sem rede, falha de download parcial
e remoção, com zero chamadas de API durante a instalação. O service worker tem
testes de isolamento de cache, APIs e outras origens. Voz foi exercitada com
speechSynthesis simulado: troca de controles e desmontagem não cancelam uma fala
alheia. Não houve escuta em dispositivo real nem teste de Safari/iOS/PWA; as
vozes de originais são modernas e apresentadas como aproximação.

## Mantido fora da publicação

Os candidatos de alinhamento de Gênesis 2–5 não têm revisão editorial; não são
apresentados como correspondências. O índice completo do Claude 3 permanece em
revisão isolada: há problemas de completude, versão e cursores descritos em
`word-study-08-validacao-codex.md`, e ainda não houve medição do corpus real.
Os cartões de autores permanecem rascunhos sem direitos e edição aprovados. As
alterações de grafo, arquivos de fontes, rascunhos de contexto e trabalhos não
relacionados permanecem no workspace, sem inclusão inadvertida. A pasta local
`data/sources/theology/` foi adicionada ao `.gitignore` para evitar publicar
bytes coletados sem revisão.

Quatro versículos — Gênesis 1:1, Salmos 23:1, João 1:1 e Apocalipse 22:1 —
foram comparados ao site publicado após a mesma limpeza USFM e coincidiram.

O usuário não foi inscrito em serviços pagos, nenhuma migration remota foi
aplicada e não se mediu a cota restante atual do Supabase ou da Cloudflare.
