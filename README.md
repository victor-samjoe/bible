# SamJoE Estudos

Base do MVP web de estudos editoriais em português brasileiro. O escopo e os fallbacks obrigatórios estão no [contrato de execução](docs/MVP_EXECUTION_CONTRACT_2026-11-19.md); a [especificação de produto](SamJoE_Plataforma_Teologica_SPEC_MVP_v1.md) fornece o contexto mais amplo.

## Desenvolvimento

Requer Node.js 22 e npm. Instale as dependências com `npm ci` e copie `.env.example` para `.env.local` caso precise configurar integrações. Não inclua credenciais no repositório.

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run check` executa lint, tipos, testes unitários/de integração e build. Para testes de navegador, instale o navegador com `npx playwright install chromium` e execute `npm run test:e2e`. A configuração de Vitest aceita uma suíte ainda vazia; isso não comprova os critérios de aceite do MVP.

Sem configurações e validações externas, login, pagamento, WhatsApp e publicação de texto bíblico licenciado não devem ser considerados disponíveis. Acompanhe os resultados e bloqueios em [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md).
