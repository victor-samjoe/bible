$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($env:CLOUDFLARE_TUNNEL_TOKEN)) {
    Write-Error 'CLOUDFLARE_TUNNEL_TOKEN está vazio. Defina-o no ambiente deste processo antes de iniciar o túnel.'
    exit 1
}

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Error 'cloudflared não foi encontrado no PATH. Instale-o e abra um novo terminal.'
    exit 1
}

# A opção --token do cloudflared também aceita a variável TUNNEL_TOKEN;
# evite passar o segredo como argumento de linha de comando.
$previousToken = $env:TUNNEL_TOKEN
try {
    $env:TUNNEL_TOKEN = $env:CLOUDFLARE_TUNNEL_TOKEN
    & cloudflared tunnel run
    $cloudflaredExitCode = $LASTEXITCODE
} finally {
    $env:TUNNEL_TOKEN = $previousToken
}
exit $cloudflaredExitCode
