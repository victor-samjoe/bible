"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "./app-shell";

/** O leitor mantém seu menu imersivo; todas as demais rotas usam a casca fixa. */
export function ApplicationFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  return pathname === "/biblia" || pathname.startsWith("/biblia/") ? children : <AppShell>{children}</AppShell>;
}
