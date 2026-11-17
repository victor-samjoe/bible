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
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
