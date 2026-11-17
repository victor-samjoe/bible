import type { Metadata } from "next";
import "./globals.css";
import { PwaRegistration } from "./pwa-registration";

export const metadata: Metadata = {
  title: "SamJoE Estudos | Leia, descubra e aprofunde",
  description: "Estudos bíblicos com contexto, fontes e leituras responsáveis.",
  manifest: "/manifest.webmanifest",
  applicationName: "SamJoE Estudos",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "SamJoE Estudos" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PwaRegistration />{children}</body></html>;
}
