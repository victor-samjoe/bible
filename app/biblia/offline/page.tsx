import Link from "next/link";
import type { Metadata } from "next";

import { OfflineControls } from "../offline-controls";

/**
 * Página dos controles de Bíblia offline.
 *
 * É estática e não consulta banco: tudo que ela mostra vem do manifesto público
 * e do armazenamento do próprio aparelho. Por isso continua abrindo quando o
 * banco está fora do ar — que é parte do ponto de ter leitura offline.
 */
export const metadata: Metadata = {
  title: "Bíblia offline | Bíblia Bereana",
  description:
    "Baixar a Bíblia Livre (BLIVRE) para leitura sem conexão, com tamanho declarado, verificação de versão e remoção a qualquer momento.",
  robots: { index: false },
};

export default function OfflinePackagePage() {
  return (
    <main className="page">
      <p className="eyebrow">LEITURA SEM CONEXÃO</p>
      <h1>Baixar a Bíblia para ler offline.</h1>
      <p className="muted">
        O download guarda o texto da tradução neste aparelho. Nada começa sem você pedir, e remover
        é imediato.
      </p>

      <OfflineControls />

      <p className="small">
        <Link className="text-link" href="/biblia">
          ← Voltar à leitura
        </Link>
      </p>
    </main>
  );
}
