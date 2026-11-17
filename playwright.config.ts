import { defineConfig, devices } from "@playwright/test";

// baseURL e servidor sao configuraveis por ambiente:
// - sem variavel, sobe `npm run dev` em 127.0.0.1:3000, como antes;
// - com PLAYWRIGHT_BASE_URL, usa um servidor ja em pe (util quando outro
//   processo ocupa a porta ou quando se quer testar o build de producao);
// - PLAYWRIGHT_CHROMIUM_PATH permite apontar um Chromium ja instalado na
//   maquina, em vez de exigir `npx playwright install`.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
