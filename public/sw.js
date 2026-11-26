const CACHE = "samjoe-static-shell-v4";

// Toda URL listada aqui precisa existir: cache.addAll rejeita em qualquer 404 e,
// com isso, a instalacao do service worker falha inteira. /apple-icon.svg foi
// removida porque o Next nao gera rota de apple-icon a partir de SVG.
//
// /leitor-offline.html e a casca de leitura offline. Ela e um arquivo estatico e
// autossuficiente, de proposito: quando a navegacao falha, servir uma pagina do
// Next para uma rota que nao e a dela faria o roteador tentar buscar o RSC da
// rota original e falhar de novo. A casca le o capitulo do IndexedDB e nao
// depende de rede, framework nem hidratacao.
const STATIC_ASSETS = ["/offline", "/icon.svg", "/leitor-offline.html"];

// Rotas de leitura: /biblia e /biblia/<livro>/<capitulo>. O capitulo precisa ser
// numero, e /biblia/offline fica fora de proposito: e a pagina de controles do
// download, que tem resposta propria e nao e capitulo nenhum.
const READER_PATH = /^\/biblia(?:\/[a-z0-9-]+\/\d{1,3})?\/?$/;
const CONTROLS_PATH = "/biblia/offline";

self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS))),
);

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      // Remove cascas de versoes anteriores; sem isso um /offline antigo
      // continuaria sendo servido depois de uma publicacao.
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name.startsWith("samjoe-static-shell-") && name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname;

  // Nada autenticado e nada de API entra em cache, em nenhuma hipotese: a
  // resposta de uma conta ficaria disponivel para a proxima no mesmo aparelho.
  if (path.startsWith("/api/")) return;

  if (STATIC_ASSETS.includes(path)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        // Com pacote instalado, a casca offline mostra o capitulo salvo. Sem
        // pacote, ela mesma explica isso e oferece a pagina generica. Mandar
        // direto para /offline deixaria a pessoa presa mesmo tendo o texto.
        if (path !== CONTROLS_PATH && READER_PATH.test(path)) {
          const reader = await caches.match("/leitor-offline.html");
          // A hospedagem pode redirecionar .html para a URL sem extensao.
          // Uma resposta redirecionada nao pode ser entregue diretamente a
          // uma navegacao offline; recriar a resposta remove esse estado.
          if (reader) return new Response(reader.body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }
        return (await caches.match("/offline")) || Response.error();
      }),
    );
  }
});
