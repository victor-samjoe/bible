# Handoff de execução — Claude

## Autoridade e limites

Execute somente esta sequência. Não altere escolhas de produto, stack, licença, provedor, preços, conteúdo editorial ou arquivos `.env*` sem instrução explícita do proprietário.

- Empresa: SamJoE Tech & Consulting.
- Projeto Supabase: `samjoe-bible-mvp`, ref `exumjnikkrevlyublrfn`, região `sa-east-1`.
- Banco: migration `drizzle/0000_initial.sql` e seed `drizzle/0001_seed_blivre.sql` já aplicados pela Management API.
- Corpus permitido: BLIVRE (`porbr2018`), CC BY 4.0 BR, com atribuição obrigatória em `docs/licenses/biblia-livre-blivre.md`.
- Nunca usar outra tradução integral sem licença documental equivalente.
- Nunca exibir tokens, chaves, senhas, conteúdo premium completo para usuário sem entitlement ou dados pessoais.
- Não publicar, criar cobrança, iniciar túnel ou fazer push sem validar cada pré-requisito e registrar evidência.

## Estado que deve ser auditado antes de editar

1. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
2. Confirmar que `.env.local` continua ignorado pelo Git e nunca será adicionado ao commit.
3. Conferir que `SUPABASE_URL` aponta para `https://exumjnikkrevlyublrfn.supabase.co` e que as chaves de runtime são usadas somente após serem preenchidas pelo proprietário.
4. Conferir o estado de Git e nunca sobrescrever `origin` (`https://github.com/victor-samjoe/bible.git`).

## Próximas tarefas, nesta ordem

1. **Corpus:** gerar `data/generated/blivre.json` com:

   ```powershell
   node --experimental-strip-types scripts/convert-blivre.ts 42f1e145-244c-4dd7-ae60-8ab66407f678 > data/generated/blivre.json
   ```

   Validar 66 livros, 1.189 capítulos e 31.102 versículos. Não modificar os USFM originais.

2. **Importação:** criar um importador em lotes, idempotente e auditável. Não fazer insert de 31 mil versículos via endpoint público nem expor a secret key. Preferir conexão server-side/configurada pelo proprietário ou migration controlada. Só marcar versos como publicados quando a tradução BLIVRE aprovada estiver relacionada à licença verificada.

3. **Leitor:** trocar o estado "em preparação" apenas depois de dados realmente importados e testados. Renderizar USFM de forma segura, sem HTML não sanitizado, e manter a atribuição BLIVRE em contexto razoável.

4. **PWA:** finalizar somente cache estático seguro. É proibido cachear respostas autenticadas, estudos premium ou qualquer resposta de API. Validar `manifest.webmanifest`, ícones e fallback `/offline`.

5. **Supabase Auth:** somente após o proprietário preencher `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY`; integrar cliente por requisição, OTP e papel vindo de tabela confiável. Sem chaves, falhar fechado.

6. **Tunnel/publicação:** `cloudflared` não está instalado. Não instalar nem iniciar túnel sem `CLOUDFLARE_TUNNEL_TOKEN` preenchido. Cloudflare Tunnel sem domínio é preview temporário, não produção definitiva.

7. **APK:** não há Android SDK/adb/Gradle detectados. APK não funciona em iPhone. Manter PWA instalável como rota iOS; só preparar Capacitor/Android após verificar SDK, Java e build web compatível. Nunca alegar APK ou IPA gerado sem caminho do artefato e teste.

## Critério de parada

Ao fim de cada tarefa, registrar em `docs/IMPLEMENTATION_LOG.md`: arquivos modificados, comandos, resultado, bloqueio e próximo item desta lista. Se uma credencial ou aprovação faltar, parar naquela integração e continuar nas tarefas locais restantes.
