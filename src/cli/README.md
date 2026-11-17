# CLI editorial interna

Execute `src/cli/index.ts` com o executor TypeScript configurado pelo projeto, passando um dos comandos do contrato. Por exemplo: `study:new --topic "Romanos 9 e eleição" --passage "Rm 9:1-33" --type doctrinal-comparison`. Os demais comandos recebem o UUID impresso na criação.

Os arquivos em `editorial-drafts/<uuid>.json` são rascunhos internos, não conteúdo publicado. Preencha manualmente os campos editoriais, fontes documentadas, permissões, localizações, afirmações e seções no JSON. `study:research` conserva o dossiê existente; `study:draft` cria uma seção vazia somente quando ainda não existe nenhuma. Nenhum comando consulta IA ou cria bibliografia.

`study:validate` informa pendências com saída não zero; `study:submit` só envia rascunhos validados à revisão. A CLI local não oferece aprovação: ela depende de uma futura integração autenticada. `study:publish` verifica as regras e continua indisponível até que promoção de versão, autorização administrativa, auditoria e invalidação de cache sejam implementadas de modo confiável. Não use o arquivo local como autorização ou como catálogo público.
