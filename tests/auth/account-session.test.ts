import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeSession, SESSION_COOKIE } from "../../src/server/auth/session";

/**
 * Máquina de estados da sessão por requisição (`src/server/auth/runtime.ts`).
 *
 * Aqui o provedor, o cookie e o banco são duplos. O que se verifica é a decisão:
 * quando a pessoa é anônima, quando é autenticada, quando o acesso é negado
 * mesmo com cookie válido, e quando a falta da fonte confiável de papel vira
 * "degradado" em vez de acesso concedido.
 */

const hoisted = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
  cookiesWritable: { value: true },
  profileRepository: {
    findRole: vi.fn(),
    ensureProfile: vi.fn(),
    requestDeletion: vi.fn(),
    hasOpenDeletionRequest: vi.fn(),
  },
  database: { value: {} as unknown },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      hoisted.cookieJar.has(name) ? { name, value: hoisted.cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => {
      // Em render de página o Next proíbe escrever cookie: este duplo reproduz isso.
      if (!hoisted.cookiesWritable.value) throw new Error("cookies são somente leitura aqui");
      hoisted.cookieJar.set(name, value);
    },
  }),
  headers: async () => new Headers({ "cf-connecting-ip": "203.0.113.9" }),
}));

// Fora do Worker não existe contexto Cloudflare; o ambiente vem de `process.env`.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => {
    throw new Error("sem contexto Cloudflare");
  },
}));

// `cache` do React precisa de requisição React; aqui vira identidade.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T>(fn: T) => fn,
}));

vi.mock("../../src/server/db/client", () => ({
  getDatabaseAsync: async () => hoisted.database.value,
}));

vi.mock("../../src/server/auth/profiles", () => ({
  createDrizzleProfileRepository: () => hoisted.profileRepository,
}));

const { getAccountSession, getViewer, requestAccessCode, endSession } = await import(
  "../../src/server/auth/runtime"
);

const userId = "b4627467-c03c-4dd6-9ba4-a4267758332f";
const profile = { id: userId, role: "reader", displayName: null, createdAt: new Date("2026-11-01T00:00:00Z") };

function liveSession(offsetSeconds = 3600): string {
  const value = encodeSession({
    accessToken: "aaaaaaaa.bbbbbbbb.cccccccc",
    refreshToken: "refresh-token-abcdefgh",
    expiresAt: Math.floor(Date.now() / 1000) + offsetSeconds,
  });
  if (value === null) throw new Error("sessão de teste inválida");
  return value;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ENVIRONMENT_KEYS = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "PUBLIC_SITE_URL"] as const;

function configure(): void {
  process.env.SUPABASE_URL = "https://projeto.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_exemplo";
  process.env.PUBLIC_SITE_URL = "https://bereana.example";
}

/** `delete` em `process.env` tipado exige índice opcional; atribuir vazio basta. */
function unset(...keys: readonly string[]): void {
  for (const key of keys) process.env[key] = "";
}

beforeEach(() => {
  hoisted.cookieJar.clear();
  hoisted.cookiesWritable.value = true;
  hoisted.database.value = {};
  hoisted.profileRepository.ensureProfile.mockResolvedValue(profile);
  hoisted.profileRepository.hasOpenDeletionRequest.mockResolvedValue(false);
  configure();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  unset(...ENVIRONMENT_KEYS);
});

describe("estado da conta por requisição", () => {
  it("sem identidade configurada, declara indisponível e não faz requisição", async () => {
    unset("SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY");
    const call = vi.fn();
    vi.stubGlobal("fetch", call);
    expect(await getAccountSession()).toEqual({ state: "unconfigured", reason: "missing_configuration" });
    expect(await getViewer()).toBeNull();
    expect(await requestAccessCode("pessoa@example.com", false)).toEqual({ ok: false, reason: "unavailable" });
    expect(call).not.toHaveBeenCalled();
  });

  it("sem cookie ou com cookie inválido, é anônimo sem consultar o provedor", async () => {
    const call = vi.fn();
    vi.stubGlobal("fetch", call);
    expect(await getAccountSession()).toEqual({ state: "anonymous" });
    hoisted.cookieJar.set(SESSION_COOKIE, "cookie-forjado-sem-formato");
    expect(await getAccountSession()).toEqual({ state: "anonymous" });
    expect(await getViewer()).toBeNull();
    expect(call).not.toHaveBeenCalled();
  });

  it("com sessão válida, confirma identidade no provedor e papel no banco", async () => {
    hoisted.cookieJar.set(SESSION_COOKIE, liveSession());
    const call = vi.fn().mockImplementation(async () => jsonResponse({ id: userId, email: "pessoa@example.com" }));
    vi.stubGlobal("fetch", call);

    const session = await getAccountSession();
    expect(session).toEqual({
      state: "authenticated",
      viewer: { id: userId, role: "reader" },
      email: "pessoa@example.com",
      profile,
      deletionRequested: false,
    });
    // O perfil é criado/confirmado no primeiro acesso, pelo id verificado.
    expect(hoisted.profileRepository.ensureProfile).toHaveBeenCalledWith(userId);
    // Uma ida ao provedor por requisição: a identidade não é consultada duas vezes.
    expect(call).toHaveBeenCalledTimes(1);
    expect(String(call.mock.calls[0]?.[0])).toBe("https://projeto.supabase.co/auth/v1/user");
  });

  it("recusa token revogado mesmo dentro da validade e apaga o cookie", async () => {
    hoisted.cookieJar.set(SESSION_COOKIE, liveSession());
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ message: "invalid JWT" }, 401)));
    expect(await getAccountSession()).toEqual({ state: "anonymous" });
    expect(hoisted.cookieJar.get(SESSION_COOKIE)).toBe("");
  });

  it("renova o access token vencido antes de usar e grava a sessão nova", async () => {
    hoisted.cookieJar.set(SESSION_COOKIE, liveSession(10));
    const antigo = hoisted.cookieJar.get(SESSION_COOKIE);
    const call = vi.fn().mockImplementation(async (url: string) =>
      String(url).includes("/token?grant_type=refresh_token")
        ? jsonResponse({
            access_token: "dddddddd.eeeeeeee.ffffffff",
            refresh_token: "refresh-token-ijklmnop",
            expires_in: 3600,
            user: { id: userId, email: "pessoa@example.com" },
          })
        : jsonResponse({ id: userId, email: "pessoa@example.com" }),
    );
    vi.stubGlobal("fetch", call);

    expect((await getAccountSession()).state).toBe("authenticated");
    expect(hoisted.cookieJar.get(SESSION_COOKIE)).not.toBe(antigo);
    expect(String(call.mock.calls[0]?.[0])).toContain("/token?grant_type=refresh_token");
  });

  it("refresh recusado encerra a sessão em vez de insistir", async () => {
    hoisted.cookieJar.set(SESSION_COOKIE, liveSession(10));
    const call = vi.fn().mockImplementation(async () => jsonResponse({ error: "invalid_grant" }, 400));
    vi.stubGlobal("fetch", call);
    expect(await getAccountSession()).toEqual({ state: "anonymous" });
    expect(hoisted.cookieJar.get(SESSION_COOKIE)).toBe("");
    // Token recusado não é usado para consultar identidade.
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("sem fonte confiável de papel, degrada sem conceder acesso", async () => {
    hoisted.cookieJar.set(SESSION_COOKIE, liveSession());
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ id: userId, email: "p@e.com" })));

    hoisted.database.value = null;
    expect(await getAccountSession()).toEqual({ state: "degraded", email: "p@e.com" });
    expect(await getViewer()).toBeNull();

    hoisted.database.value = {};
    hoisted.profileRepository.ensureProfile.mockRejectedValue(new Error("banco fora do ar"));
    expect(await getAccountSession()).toEqual({ state: "degraded", email: "p@e.com" });

    // Papel fora do enum é tratado como ausência de papel, não como leitor.
    hoisted.profileRepository.ensureProfile.mockResolvedValue({ ...profile, role: "dono" });
    expect(await getAccountSession()).toEqual({ state: "degraded", email: "p@e.com" });
    expect(await getViewer()).toBeNull();
  });

  it("não derruba a página quando o cookie não pode ser escrito no render", async () => {
    hoisted.cookieJar.set(SESSION_COOKIE, liveSession(10));
    hoisted.cookiesWritable.value = false;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) =>
        String(url).includes("/token?grant_type=refresh_token")
          ? jsonResponse({
              access_token: "dddddddd.eeeeeeee.ffffffff",
              refresh_token: "refresh-token-ijklmnop",
              expires_in: 3600,
              user: { id: userId, email: "pessoa@example.com" },
            })
          : jsonResponse({ id: userId, email: "pessoa@example.com" }),
      ),
    );
    // A renovação não persiste nesta requisição, mas a sessão continua utilizável.
    expect((await getAccountSession()).state).toBe("authenticated");
  });

  it("recusa e-mail malformado antes de gastar cota de limite ou chamar o provedor", async () => {
    const call = vi.fn();
    vi.stubGlobal("fetch", call);
    for (const invalido of ["", "   ", "sem-arroba", "pessoa@", "@example.com"]) {
      expect(await requestAccessCode(invalido, false)).toEqual({ ok: false, reason: "invalid_email" });
    }
    // Digitar errado cinco vezes não pode travar o acesso de quem acertar depois.
    expect(await requestAccessCode("sem-arroba", false)).toEqual({ ok: false, reason: "invalid_email" });
    expect(call).not.toHaveBeenCalled();
  });

  it("limita pedidos repetidos de código para o mesmo e-mail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({})));
    const email = `limite-${Date.now()}@example.com`;
    expect(await requestAccessCode(email, false)).toEqual({ ok: true });
    expect(await requestAccessCode(email, false)).toEqual({ ok: true });
    expect(await requestAccessCode(email, false)).toEqual({ ok: true });
    expect(await requestAccessCode(email, false)).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("sair apaga o cookie mesmo quando o provedor recusa a revogação", async () => {
    hoisted.cookieJar.set(SESSION_COOKIE, liveSession());
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => jsonResponse({ error: "boom" }, 500)));
    await endSession();
    expect(hoisted.cookieJar.get(SESSION_COOKIE)).toBe("");
  });
});
