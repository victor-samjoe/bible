import type { Metadata } from "next";
import "./globals.css";
import { PwaRegistration } from "./pwa-registration";
import { ApplicationFrame } from "./_components/application-frame";

export const metadata: Metadata = {
  title: "Bíblia Bereana | Leia, descubra e aprofunde",
  description: "Estudos bíblicos com contexto, fontes e leituras responsáveis.",
  manifest: "/manifest.webmanifest",
  applicationName: "Bíblia Bereana",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Bíblia Bereana" },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><head><meta charSet="utf-8" /></head><body><PwaRegistration /><ApplicationFrame>{children}</ApplicationFrame></body></html>;
}
