import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bíblia Bereana",
    short_name: "Bereana",
    description: "Leitura bíblica e estudos editoriais com fontes rastreáveis.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ec",
    theme_color: "#315a46",
    lang: "pt-BR",
    // Só entra aqui URL que o app realmente serve. O Next publica `app/icon.svg`
    // em /icon.svg, mas não gera rota de apple-icon a partir de SVG — por isso
    // /apple-icon.svg não é mais referenciada.
    //
    // Pendente de arte aprovada pelo proprietário: PNG 192x192 e 512x512 com
    // `purpose: "maskable"` (exigência de instalação no Android/Play) e
    // apple-touch-icon PNG 180x180 (iOS). Ver docs/MOBILE_RELEASE.md.
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
