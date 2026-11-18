import { and, eq, inArray } from "drizzle-orm";
import { accountDeletionRequests, profiles } from "@/drizzle/schema";
import type { Database } from "../db/client";

/**
 * Perfis e pedidos de exclusão: a fonte confiável de papel e o registro de
 * exclusão de conta.
 *
 * Regra que não se negocia nesta frente: papel vem **daqui**, nunca de cookie,
 * formulário, query, cabeçalho ou `user_metadata` do provedor — tudo isso é
 * editável por quem está do lado de fora. Quem lê papel lê `profiles.role`.
 *
 * O tipo `Database` entra só como tipo, para este módulo não arrastar `pg` nem
 * `@opennextjs/cloudflare` para quem só quer o contrato.
 */

export interface ProfileRecord {
  readonly id: string;
  readonly role: string;
  readonly displayName: string | null;
  readonly createdAt: Date;
}

export interface ProfileRepository {
  /** Papel declarado no banco, ou `null` quando não há perfil. */
  findRole(userId: string): Promise<string | null>;
  /** Cria o perfil no primeiro acesso e devolve o registro confiável. */
  ensureProfile(userId: string): Promise<ProfileRecord | null>;
  /** `true` quando existe pedido de exclusão aberto depois da chamada. */
  requestDeletion(userId: string): Promise<boolean>;
  hasOpenDeletionRequest(userId: string): Promise<boolean>;
}

/** Estados em que o pedido de exclusão ainda não foi resolvido. */
const OPEN_DELETION_STATES = ["requested", "in_progress"] as const;

export function createDrizzleProfileRepository(database: Database): ProfileRepository {
  async function selectProfile(userId: string): Promise<ProfileRecord | null> {
    const rows = await database
      .select({
        id: profiles.id,
        role: profiles.role,
        displayName: profiles.displayName,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return rows.at(0) ?? null;
  }

  async function hasOpenDeletionRequest(userId: string): Promise<boolean> {
    const rows = await database
      .select({ id: accountDeletionRequests.id })
      .from(accountDeletionRequests)
      .where(
        and(
          eq(accountDeletionRequests.userId, userId),
          inArray(accountDeletionRequests.state, [...OPEN_DELETION_STATES]),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  return {
    async findRole(userId) {
      const profile = await selectProfile(userId);
      return profile === null ? null : profile.role;
    },

    async ensureProfile(userId) {
      const now = new Date();
      // Papel fixo em `reader`: criar conta nunca concede editor ou admin.
      // Elevação é operação administrativa, fora deste caminho.
      await database
        .insert(profiles)
        .values({ id: userId, displayName: null, role: "reader", createdAt: now, updatedAt: now })
        .onConflictDoNothing();
      return await selectProfile(userId);
    },

    hasOpenDeletionRequest,

    async requestDeletion(userId) {
      if (await hasOpenDeletionRequest(userId)) return true;
      const now = new Date();
      // Sem `ON CONFLICT`: o índice parcial único da migration 0006 garante um
      // pedido aberto por pessoa, e uma corrida perdida cai no `catch` abaixo
      // sabendo que o pedido do concorrente já está registrado.
      try {
        await database.insert(accountDeletionRequests).values({
          id: crypto.randomUUID(),
          userId,
          state: "requested",
          requestedAt: now,
          resolvedAt: null,
          resolvedBy: null,
          updatedAt: now,
        });
        return true;
      } catch {
        return await hasOpenDeletionRequest(userId);
      }
    },
  };
}
