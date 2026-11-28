# Migração gradual para Cloudflare — 28/11/2026

## Estado atual

- O site já roda em Cloudflare Workers; o binding `ASSETS` entrega arquivos
  públicos. A Bíblia para download offline, prévias de versículos e o índice
  público de ocorrências são estáticos. O texto da leitura principal, a busca,
  os originais, definições, perfil e dados pessoais ainda consultam Postgres;
  autenticação usa Supabase Auth e SMTP próprio.
- O pacote offline corresponde ao corpus local em 66 livros, 1.189 capítulos e
  31.102 versículos. A comparação anterior com o banco publicado foi amostral,
  não uma prova integral de igualdade nem do estado editorial de produção.
- O acesso da aplicação ao Postgres usa credencial com privilégios elevados;
  RLS de `auth.uid()` não substitui a autorização explícita no servidor. Não
  migrar dados pessoais sem testar isolamento entre contas e fluxos de exclusão.

## Primeira peça preparada

`src/server/bible/static-cloudflare.ts` lê apenas o pacote público aprovado para
distribuição, com manifesto, atribuição, versão, validação de integridade e
limpeza USFM. A porta de runtime `static-cloudflare-runtime.ts` usa o binding
`ASSETS`, sem criar D1 ou consultar Postgres. Ela **ainda não está ligada à rota
de leitura**: não constrói UUIDs falsos, não muda contas, notas ou progresso.

`scripts/verify-cloudflare-static-reader.mjs` comparou os 31.102 versículos
com o corpus **local**, sem acesso de rede. Os testes verificam falha ao receber
livro adulterado. Isso não prova que o texto ou os estados de publicação do
banco remoto sejam idênticos. Antes de trocar a fonte: comparar versão e texto
com produção por método limitado e somente leitura, preservar estados editoriais
e IDs usados por outras funções, medir CPU do Worker e testar fallback e rollback.

## Proposta de divisão

1. Arquivos estáticos versionados ou R2 para textos públicos, índices e áudio;
   o usuário pode manter downloads opcionais no aparelho. R2 requer avaliação
   específica de ativação, cobrança, range e cache antes de uso.
2. D1 apenas para dados mutáveis que realmente precisem de banco, com consultas
   indexadas, medição de linhas examinadas e revisão de isolamento. D1 é SQLite,
   não substitui PostgreSQL nem suas políticas RLS automaticamente.
3. Autenticação: manter Supabase Auth durante a transição. Caso seja substituído,
   escolher uma solução de identidade para usuários do produto e projetar
   migração de sessões, contas, IDs, recuperação e entrega de e-mail. Cloudflare
   Access é uma ferramenta de controle de acesso, não uma troca automática por
   todo o fluxo atual de contas. Não alterar SES, DNS, credenciais ou SMTP.
4. Cortar o Supabase somente depois de migração completa, conciliação dos dados,
   autorização testada, backups, observabilidade e rollback; não apagar recursos
   nem desligar a origem durante o piloto.

## Limites públicos, não consumo da conta

Conforme documentação consultada em 28/11/2026, D1 Free permite 5 milhões de
linhas lidas/dia, 100 mil escritas/dia e 5 GB somados na conta; cada banco Free
tem máximo de 500 MB. Linhas examinadas e índices contam, não apenas resultados
devolvidos. Ao exceder cotas diárias as consultas podem falhar até o reset.
R2 Standard inclui 10 GB-mês e 10 milhões de operações de leitura por mês, mas
possui cobrança acima da franquia. Esses são limites do serviço, não medição da
conta atual nem garantia de que será gratuito para qualquer demanda.

Fontes: https://developers.cloudflare.com/d1/platform/pricing/ ;
https://developers.cloudflare.com/d1/platform/limits/ ;
https://developers.cloudflare.com/r2/pricing/ ;
https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/ .
