import { confirmEmailLink, confirmOAuthCode } from "../../../src/server/auth/runtime";

/**
 * Retorno do link enviado por e-mail (frente A do plano de contas).
 *
 * O Supabase pode ser configurado para apontar o template de e-mail para
 * `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`. Esta
 * rota troca esse `token_hash` por uma sessão no servidor e grava o cookie
 * `httpOnly`. O token nunca chega ao JavaScript da página e nunca é registrado.
 *
 * Três decisões de segurança ficam registradas aqui:
 *
 *  1. **Sem redirecionamento aberto.** O parâmetro `next` é ignorado de
 *     propósito. Aceitá-lo transformaria o link de login em redirecionador para
 *     domínio de terceiro, que é o vetor clássico de phishing nessa rota. O
 *     destino é sempre `/conta`.
 *  2. **Sem vazamento de motivo.** Token inválido, expirado, já usado, tipo
 *     recusado e provedor fora do ar terminam todos em `/entrar?erro=link`. A
 *     query não distingue "não existe" de "expirou".
 *  3. **Sem cache.** A resposta carrega credencial de sessão no cabeçalho
 *     `Set-Cookie`; qualquer cache intermediário seria vazamento.
 *
 * Nota conhecida do fluxo por link: um verificador de e-mail ou um proxy de
 * segurança que faça pré-busca do link consome o token de uso único e a pessoa
 * vê "link inválido". Por isso o caminho padrão da interface é o código de 6
 * dígitos digitado em `/entrar`, e esta rota é o atalho, não o fluxo principal.
 */
export const dynamic = "force-dynamic";

function seeOther(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

function clearVerifier(response: Response, request: Request): Response {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  response.headers.append("Set-Cookie", `samjoe_oauth_verifier=; Path=/auth/callback; HttpOnly${secure}; SameSite=Lax; Max-Age=0`);
  return response;
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const verifier = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith("samjoe_oauth_verifier="))?.slice("samjoe_oauth_verifier=".length) ?? "";

  // OAuth e links de e-mail usam a mesma rota, mas a interface não deve atribuir
  // um cancelamento do Google a um link de e-mail. Nunca repassamos detalhes.
  if (params.get("error") || params.get("error_code")) {
    const response = seeOther(verifier ? "/entrar?erro=google" : "/entrar?erro=link");
    return verifier ? clearVerifier(response, request) : response;
  }

  const authCode = params.get("code") ?? "";
  if (authCode) {
    const result = await confirmOAuthCode(authCode, verifier);
    const response = seeOther(result.ok ? "/conta?login=concluido" : "/entrar?erro=google");
    return clearVerifier(response, request);
  }
  const tokenHash = params.get("token_hash") ?? "";
  const type = params.get("type") ?? "";
  if (!tokenHash) return seeOther("/entrar?erro=link");

  const result = await confirmEmailLink(tokenHash, type);
  if (!result.ok) {
    return seeOther(result.reason === "unavailable" ? "/entrar" : "/entrar?erro=link");
  }
  return seeOther("/conta?login=concluido");
}
