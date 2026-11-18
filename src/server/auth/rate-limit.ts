/**
 * Limite de tentativas em janela fixa, em memória.
 *
 * Função pura com relógio injetado: o teste controla o tempo e não há `setTimeout`
 * pendurado em requisição alguma.
 *
 * Limitação registrada de propósito, porque muda a garantia: no Cloudflare Workers
 * cada isolate tem a própria memória e isolates são descartados a qualquer momento.
 * Este limitador reduz abuso repetido vindo do mesmo isolate — ele **não** é um
 * limite global por conta. O limite global precisa de armazenamento compartilhado
 * (KV, Durable Object ou tabela), que ainda não está provisionado; está anotado em
 * `docs/ACCOUNT_AND_ORIGINALS_EXECUTION_PLAN.md`. Enquanto isso, o Supabase Auth
 * aplica o próprio limite de envio de e-mail do lado dele, e as respostas desta
 * aplicação são neutras — então o pior caso é envio repetido, não enumeração.
 */

export type RateLimitDecision =
  | { readonly allowed: true; readonly remaining: number }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

export interface RateLimiter {
  check(key: string, nowMs?: number): RateLimitDecision;
  reset(): void;
}

export interface RateLimiterOptions {
  readonly limit: number;
  readonly windowSeconds: number;
  /** Teto de chaves vivas; impede que tráfego hostil transforme o mapa em vazamento de memória. */
  readonly maxKeys?: number;
}

const DEFAULT_MAX_KEYS = 5000;

/**
 * Hash FNV-1a de 32 bits. Não é segurança: serve para normalizar a chave e
 * evitar guardar e-mail em texto numa estrutura que poderia aparecer num dump
 * de memória. Colisão só uniria dois limites, nunca liberaria um bloqueio.
 */
export function hashRateLimitKey(value: string): string {
  let hash = 0x811c9dc5;
  const normalized = value.trim().toLowerCase();
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16)}:${normalized.length}`;
}

export function createFixedWindowLimiter(options: RateLimiterOptions): RateLimiter {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1, Math.floor(options.windowSeconds)) * 1000;
  const maxKeys = Math.max(1, Math.floor(options.maxKeys ?? DEFAULT_MAX_KEYS));
  const windows = new Map<string, { count: number; resetAt: number }>();

  function evict(nowMs: number): void {
    for (const [key, window] of windows) if (window.resetAt <= nowMs) windows.delete(key);
    // Map preserva ordem de inserção: os primeiros são os mais antigos.
    while (windows.size >= maxKeys) {
      const oldest = windows.keys().next();
      if (oldest.done) break;
      windows.delete(oldest.value);
    }
  }

  return {
    check(key, nowMs = Date.now()) {
      // Relógio inválido não pode virar passe livre.
      if (!Number.isFinite(nowMs)) return { allowed: false, retryAfterSeconds: Math.ceil(windowMs / 1000) };
      const hashed = hashRateLimitKey(key);
      const current = windows.get(hashed);
      if (current === undefined || current.resetAt <= nowMs) {
        evict(nowMs);
        windows.set(hashed, { count: 1, resetAt: nowMs + windowMs });
        return { allowed: true, remaining: limit - 1 };
      }
      if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - nowMs) / 1000)) };
      }
      current.count += 1;
      return { allowed: true, remaining: limit - current.count };
    },
    reset() {
      windows.clear();
    },
  };
}
