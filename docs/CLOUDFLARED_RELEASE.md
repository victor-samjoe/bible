# Cloudflare Tunnel: operação

O túnel encaminha tráfego para uma aplicação Next.js em execução; ele não hospeda a aplicação por si só. Para produção estável, é necessário um domínio sob controle do operador, configurado na Cloudflare, um túnel nomeado com hostname público e uma hospedagem/processo confiável para o Next.js. Nenhum túnel foi iniciado ou publicado nesta preparação.

## Aplicação local

Na raiz do projeto, instale as dependências com `npm ci`, se necessário. Para testar localmente, execute `npm run dev`. Para servir o build de produção, execute `npm run build` e depois `npm start`. Por padrão, o Next.js atende em `http://localhost:3000`; confirme a porta indicada no terminal. Mantenha esse processo ativo.

## Túnel nomeado

1. Instale o `cloudflared` e confirme sua disponibilidade com `cloudflared --version`.
2. No painel Cloudflare Zero Trust, configure um túnel nomeado e um hostname do domínio que encaminhe para `http://localhost:3000` (ou a porta efetiva do Next.js). Obtenha o token do túnel no painel.
3. Em outro PowerShell, defina `CLOUDFLARE_TUNNEL_TOKEN` no ambiente do processo por um mecanismo seguro e execute `./scripts/start-tunnel.ps1` a partir da raiz. O script não lê `.env.local` automaticamente. Não registre ou compartilhe o token; ele autoriza a execução do túnel.
4. Mantenha os dois processos ativos. Para encerrar, use Ctrl+C no terminal do túnel. A configuração do hostname no painel, e não `CLOUDFLARE_TUNNEL_HOSTNAME` no ambiente local, determina o encaminhamento deste fluxo.

## Túnel temporário para teste

Com o Next.js ativo e `cloudflared` instalado, execute em outro terminal:

```powershell
cloudflared tunnel --url http://localhost:3000
```

Esse comando disponibiliza a aplicação publicamente e imprime uma URL temporária que pode mudar quando o processo reiniciar. Use somente quando a exposição pública for pretendida. Encerre com Ctrl+C. A URL temporária não substitui domínio e configuração de produção estáveis.
