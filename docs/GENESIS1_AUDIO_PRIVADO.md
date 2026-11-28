# Piloto privado de áudio — Gênesis 1

Estado: **homologação não comercial**. O proprietário autorizou colocar a amostra
da demonstração de Gênesis 1:1–3 no site ainda não divulgado. Ela não representa
o capítulo todo e não tem autorização comercial presumida. Nenhuma chave foi
registrada e nenhuma assinatura foi contratada.

`ReadChapterAloud` aceita um `recording` opcional: rótulo, URL na rota privada,
SHA-256 do texto e número de versículos. O áudio só aparece quando o hash do
texto completo recebido pelo leitor confere; não carrega antes do toque e mantém
a voz do aparelho como alternativa. Ao alternar entre voz e gravação, uma para
a outra. Um registro de áudio ausente não altera o comportamento atual.

## Ainda necessário para o teste privado

1. Conta gratuita Cartesia do proprietário, em https://play.cartesia.ai/;
   usar a API oficial, sem colar credenciais em mensagens ou no repositório.
2. Gerar Gênesis 1 completo da Bíblia Livre, conferindo os 31 versículos e a
   pronúncia. Manter texto, versão, voz, hash e a atribuição da Bíblia Livre.
3. Criar uma entrega **autenticada e restrita ao proprietário**, com resposta
   privada sem cache compartilhado. A rota `/api/private-audio/...` ainda não
   existe; nomes sob essa rota no reprodutor não autorizam acesso por si só.
   Não publicar a gravação completa comercialmente sem licença adequada.
4. Testar no iPhone, inclusive início, pausa, retomada, fim e texto divergente.
   Estimar e medir custo de armazenamento e chamadas antes de escolher R2.
5. Para uso público/comercial, verificar e contratar a licença aplicável e
   gerar o conteúdo conforme seus termos; o plano gratuito é de avaliação pessoal.

O hash é calculado sobre os versículos numerados em ordem, com espaços
normalizados e um espaço entre versículos, sem marcas USFM. Não usar dados de
outra tradução nem divulgar áudio de demonstração como narração autorizada.

O texto local preparado em `data/generated/audio-evaluation/genesis-1-blivre.txt`
tem 31 versículos, 3.529 caracteres e SHA-256
`bf82d0cd03843326e9dc132acfda55c1b03bd2caecbe751683d3accfabb6a493`.
Conferir novamente o hash na geração; o arquivo é local e não é incluído no Git.
